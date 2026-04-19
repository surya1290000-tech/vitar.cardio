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
  mode?: string;
  title?: string;
  summary?: string;
  sections?: Array<{
    label: string;
    content: string;
  }>;
  nextSteps?: string[];
  traceId?: string;
  intent?: string;
  safetyFlags?: string[];
  confidence?: number;
  confidenceReason?: string;
  actions?: Array<{
    type: 'open_dashboard' | 'open_care_center' | 'create_support_ticket' | 'summarize_readings';
    label: string;
    payload?: Record<string, unknown>;
  }>;
};

const quickPrompts = [
  'I feel chest discomfort. What should I do right now?',
  'Summarize my latest heart readings.',
  'My device is not syncing. Help me troubleshoot it.',
  'My payment failed. Help me fix billing.',
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
  const [feedbackSubmitting, setFeedbackSubmitting] = useState<Record<string, boolean>>({});
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, boolean>>({});

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

  const submitFeedback = useCallback(
    async (assistantChatId: number | string, helpful: boolean) => {
      const key = String(assistantChatId);
      if (!/^\d+$/.test(key)) return;
      const comment = !helpful ? window.prompt('Optional: tell us what was missing in this reply.', '') ?? '' : '';
      setFeedbackSubmitting((prev) => ({ ...prev, [key]: true }));
      try {
        const token = await ensureAccessToken();
        if (!token) {
          throw new Error('Your session expired. Please sign in again.');
        }
        const res = await fetch('/api/health-assistant/feedback', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assistantChatId: Number(key),
            helpful,
            comment: comment.trim() || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || 'Feedback save failed.');
        }
        setFeedbackGiven((prev) => ({ ...prev, [key]: true }));
        showToast({
          type: 'success',
          title: 'Feedback Saved',
          message: helpful ? 'Thanks — this response is marked helpful.' : 'Thanks — we will improve this response.',
        });
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Feedback Failed',
          message: error?.message || 'Could not save feedback.',
        });
      } finally {
        setFeedbackSubmitting((prev) => ({ ...prev, [key]: false }));
      }
    },
    [ensureAccessToken, showToast],
  );

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
      const normalizedReply =
        json?.reply ??
        (json?.response
          ? {
              id: `reply-${Date.now()}`,
              role: 'assistant' as const,
              message: json.response.reply,
              createdAt: new Date().toISOString(),
              sections: json.response.sections,
              nextSteps: json.response.nextSteps,
              actions: json.response.actions,
              safetyFlags: json.response.safetyFlags,
              traceId: json.response.traceId,
            }
          : null);

      setMessages((prev) => {
        const withoutOptimistic = prev.filter((item) => item.id !== optimisticId);
        return normalizedReply ? [...withoutOptimistic, optimisticMessage, normalizedReply] : withoutOptimistic;
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

  const handleAssistantAction = async (action: NonNullable<AssistantMessage['actions']>[number]) => {
    if (action.type === 'open_dashboard') {
      router.push('/dashboard');
      return;
    }

    if (action.type === 'open_care_center') {
      router.push('/care-center');
      return;
    }

    if (action.type === 'create_support_ticket') {
      if (action.payload?.autoCreate) {
        try {
          const token = await ensureAccessToken();
          if (!token) {
            throw new Error('Your session expired. Please sign in again.');
          }

          const res = await fetch('/api/support/tickets', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              subject: action.payload.subject,
              category: action.payload.category,
              priority: action.payload.priority,
              description: action.payload.description,
            }),
          });
          const json = await res.json();
          if (!res.ok) {
            throw new Error(json?.error || 'Failed to create support ticket.');
          }

          showToast({
            type: 'success',
            title: 'Support Ticket Created',
            message: action.payload.category === 'billing' ? 'Billing support ticket is ready in care center.' : 'Device support ticket is ready in care center.',
          });
          router.push('/care-center');
          return;
        } catch (error: any) {
          showToast({
            type: 'error',
            title: 'Ticket Creation Failed',
            message: error?.message || 'Could not create support ticket.',
          });
          return;
        }
      }

      if (action.payload) {
        const payload = { ...action.payload };
        delete payload.autoCreate;
        window.localStorage.setItem('vitar-care-ticket-draft', JSON.stringify(payload));
      }
      router.push('/care-center');
      return;
    }

    if (action.type === 'summarize_readings') {
      await handleSend(undefined, 'Summarize my latest heart readings.');
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
                {warning ? (
                  <button
                    type="button"
                    className="floating-prompt-chip"
                    onClick={() => void loadHistory()}
                    disabled={loadingHistory}
                  >
                    {loadingHistory ? 'Retrying...' : 'Retry Loading'}
                  </button>
                ) : null}

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
                        {message.role === 'assistant' && (message.title || message.mode) ? (
                          <div className="floating-message-meta">
                            {message.title ? <strong>{message.title}</strong> : null}
                            {message.mode ? <span>{message.mode.replace(/_/g, ' ')}</span> : null}
                          </div>
                        ) : null}
                        {message.role === 'assistant' && message.summary ? (
                          <div className="floating-message-summary">{message.summary}</div>
                        ) : null}
                        <p>{message.message}</p>
                        {message.role === 'assistant' && typeof message.confidence === 'number' ? (
                          <div className="floating-message-confidence">
                            Confidence {Math.round(message.confidence * 100)}%
                          </div>
                        ) : null}
                        {message.role === 'assistant' && Array.isArray(message.sections) && message.sections.length > 0 ? (
                          <div className="floating-message-sections">
                            {message.sections.slice(0, 3).map((section) => (
                              <div key={`${message.id}-${section.label}`} className="floating-message-section">
                                <strong>{section.label}</strong>
                                <p>{section.content}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {message.role === 'assistant' && Array.isArray(message.nextSteps) && message.nextSteps.length > 0 ? (
                          <ul className="floating-message-steps">
                            {message.nextSteps.slice(0, 3).map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ul>
                        ) : null}
                        {message.role === 'assistant' && Array.isArray(message.actions) && message.actions.length > 0 ? (
                          <div className="floating-message-actions">
                            {message.actions.map((action) => (
                              <button
                                key={`${message.id}-${action.type}-${action.label}`}
                                type="button"
                                className="floating-message-action"
                                onClick={() => void handleAssistantAction(action)}
                                disabled={sending}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {message.role === 'assistant' ? (
                          <div className="floating-message-feedback">
                            <button
                              type="button"
                              disabled={feedbackGiven[String(message.id)] || feedbackSubmitting[String(message.id)]}
                              onClick={() => void submitFeedback(message.id, true)}
                            >
                              Helpful
                            </button>
                            <button
                              type="button"
                              disabled={feedbackGiven[String(message.id)] || feedbackSubmitting[String(message.id)]}
                              onClick={() => void submitFeedback(message.id, false)}
                            >
                              Not Helpful
                            </button>
                          </div>
                        ) : null}
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
