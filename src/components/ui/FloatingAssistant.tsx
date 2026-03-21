'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/components/ui/ToastProvider';

type AssistantMessage = {
  id: number | string;
  role: 'user' | 'assistant';
  message: string;
  createdAt: string;
  severity?: 'normal' | 'high' | 'urgent' | string;
};

const quickPrompts = [
  'I feel chest discomfort. What should I do right now?',
  'Summarize my latest heart readings.',
  'Give me a simple heart-health routine for today.',
];

const hiddenPrefixes = ['/admin', '/login', '/signup', '/verify', '/reset-password'];

export default function FloatingAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const { user, accessToken, isAuthenticated, setUser } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [warning, setWarning] = useState('');
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  const shouldHide = useMemo(() => {
    if (!pathname) return false;
    if (pathname.startsWith('/care-center')) return true;
    return hiddenPrefixes.some((prefix) => pathname.startsWith(prefix));
  }, [pathname]);

  const ensureAccessToken = useCallback(async () => {
    if (accessToken) return accessToken;
    if (!user) return null;

    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    const refreshJson = await refreshRes.json();
    if (!refreshRes.ok || !refreshJson?.accessToken) return null;

    if (refreshJson?.user) {
      setUser(refreshJson.user, refreshJson.accessToken);
    } else {
      setUser(user, refreshJson.accessToken);
    }

    return refreshJson.accessToken as string;
  }, [accessToken, user, setUser]);

  const loadHistory = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoadingHistory(true);
    try {
      const token = await ensureAccessToken();
      if (!token) return;

      const res = await fetch('/api/health-assistant/chat?limit=24', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load assistant history.');
      }

      const nextMessages = Array.isArray(json?.messages) ? json.messages : [];
      setMessages(nextMessages);
      setWarning(typeof json?.warning === 'string' ? json.warning : '');
      setHasLoadedHistory(true);
    } catch (error: any) {
      setWarning(error?.message || 'Failed to load assistant history.');
    } finally {
      setLoadingHistory(false);
    }
  }, [ensureAccessToken, isAuthenticated]);

  useEffect(() => {
    if (isOpen && isAuthenticated && !hasLoadedHistory) {
      void loadHistory();
    }
  }, [isOpen, isAuthenticated, hasLoadedHistory, loadHistory]);

  useEffect(() => {
    if (!isAuthenticated) {
      setMessages([]);
      setHasLoadedHistory(false);
      setWarning('');
    }
  }, [isAuthenticated]);

  const handleOpen = async () => {
    if (!isAuthenticated) {
      showToast({
        type: 'info',
        title: 'Sign In Required',
        message: 'Sign in to chat with the VITAR health assistant.',
      });
      router.push('/login');
      return;
    }

    setIsOpen((prev) => !prev);
  };

  const handleSend = async (e?: FormEvent, preset?: string) => {
    if (e) e.preventDefault();
    const nextMessage = (preset ?? input).trim();
    if (!nextMessage || sending) return;

    const optimisticId = `temp-${Date.now()}`;
    const optimisticMessage: AssistantMessage = {
      id: optimisticId,
      role: 'user',
      message: nextMessage,
      createdAt: new Date().toISOString(),
    };

    setSending(true);
    setInput('');
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const token = await ensureAccessToken();
      if (!token) {
        throw new Error('Your session expired. Please sign in again.');
      }

      const res = await fetch('/api/health-assistant/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: nextMessage }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Assistant request failed.');
      }

      setMessages((prev) => {
        const withoutOptimistic = prev.filter((item) => item.id !== optimisticId);
        return json?.reply ? [...withoutOptimistic, optimisticMessage, json.reply] : withoutOptimistic;
      });
    } catch (error: any) {
      setMessages((prev) => prev.filter((item) => item.id !== optimisticId));
      setInput(nextMessage);
      showToast({
        type: 'error',
        title: 'Assistant Error',
        message: error?.message || 'Assistant request failed.',
      });
    } finally {
      setSending(false);
    }
  };

  if (shouldHide) return null;

  return (
    <div className={`floating-assistant ${isOpen ? 'open' : ''}`}>
      {isOpen && (
        <section className="floating-assistant-panel" aria-label="VITAR AI Assistant">
          <header className="floating-assistant-header">
            <div>
              <div className="floating-assistant-kicker">VITAR Care Assistant</div>
              <h3>Quiet guidance, right when you need it</h3>
            </div>
            <button
              type="button"
              className="floating-assistant-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant"
            >
              ×
            </button>
          </header>

          <div className="floating-assistant-body">
            {!isAuthenticated ? (
              <div className="floating-assistant-empty">
                <p>Sign in to discuss symptoms, wearable readings, support questions, and next steps with the assistant.</p>
                <button type="button" className="floating-assistant-primary" onClick={() => router.push('/login')}>
                  Go To Sign In
                </button>
              </div>
            ) : (
              <>
                <div className="floating-assistant-meta">
                  <span>{user?.firstName ? `Hi ${user.firstName}` : 'Assistant ready'}</span>
                  <span>Private care conversation</span>
                </div>

                {warning ? <div className="floating-assistant-warning">{warning}</div> : null}

                <div className="floating-assistant-messages">
                  {loadingHistory ? (
                    <div className="floating-assistant-empty">Loading assistant history...</div>
                  ) : messages.length === 0 ? (
                    <div className="floating-assistant-empty">
                      <p>Start with a quick prompt or ask your own question.</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <article
                        key={message.id}
                        className={`floating-message ${message.role === 'assistant' ? 'assistant' : 'user'} ${
                          message.severity ? `severity-${message.severity}` : ''
                        }`}
                      >
                        <div className="floating-message-head">
                          <span>{message.role === 'assistant' ? 'VITAR Care' : 'You'}</span>
                          <time>{new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</time>
                        </div>
                        <p>{message.message}</p>
                      </article>
                    ))
                  )}

                  {sending && (
                    <div className="floating-message assistant typing">
                      <div className="floating-message-head">
                        <span>VITAR Care</span>
                        <span>typing...</span>
                      </div>
                      <p>Thinking through the safest next step...</p>
                    </div>
                  )}
                </div>

                <div className="floating-assistant-prompts">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="floating-prompt-chip"
                      onClick={() => void handleSend(undefined, prompt)}
                      disabled={sending}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <form className="floating-assistant-form" onSubmit={handleSend}>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about symptoms, readings, recovery steps, or device guidance..."
                    rows={3}
                  />
                  <button
                    type="submit"
                    className="floating-assistant-primary"
                    disabled={sending || input.trim().length < 2}
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      )}

      <button
        type="button"
        className="floating-assistant-launcher"
        onClick={handleOpen}
        aria-label="Open VITAR AI Assistant"
      >
        <span className="floating-assistant-launcher-core">
          <span className="floating-assistant-launcher-wordmark">
            V<span>.</span>
          </span>
        </span>
      </button>
    </div>
  );
}
