'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Cursors from '@/components/ui/Cursors';
import Heart3D from '@/components/care/Heart3D';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/components/ui/ToastProvider';

type AssistantMessage = {
  id: number;
  role: 'user' | 'assistant';
  message: string;
  createdAt: string;
  severity?: 'normal' | 'high' | 'urgent';
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

type SupportTicket = {
  id: string;
  subject: string;
  category: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  description: string;
  messageCount: number;
  lastMessageAt: string | null;
  updatedAt: string;
};

type SupportMessage = {
  id: number;
  ticketId: string;
  senderType: 'user' | 'support';
  message: string;
  createdAt: string;
};

const quickPrompts = [
  'I feel chest discomfort. What should I do now?',
  'My device is not syncing. Help me troubleshoot it.',
  'My payment failed. Help me fix billing.',
  'Give me a 24-hour heart-health checklist.',
  'How should I react if risk score goes high?',
];

export default function CareCenterPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, accessToken, isAuthenticated, setUser } = useAuthStore();

  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantSending, setAssistantSending] = useState(false);
  const [assistantWarning, setAssistantWarning] = useState('');
  const [assistantFeedbackSubmitting, setAssistantFeedbackSubmitting] = useState<Record<string, boolean>>({});
  const [assistantFeedbackGiven, setAssistantFeedbackGiven] = useState<Record<string, boolean>>({});

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<SupportMessage[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketMessagesLoading, setTicketMessagesLoading] = useState(false);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [ticketReply, setTicketReply] = useState('');
  const [supportWarning, setSupportWarning] = useState('');
  const [ticketMessagesWarning, setTicketMessagesWarning] = useState('');

  const [ticketForm, setTicketForm] = useState({
    subject: '',
    category: 'general',
    priority: 'normal',
    description: '',
  });

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId]
  );

  const getAccessToken = useCallback(async () => {
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

  const loadAssistantHistory = useCallback(async (token: string) => {
    setAssistantLoading(true);
    try {
      const res = await fetch('/api/health-assistant/chat?limit=60', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load assistant history.');
      }
      setAssistantMessages(Array.isArray(json?.messages) ? json.messages : []);
      setAssistantWarning(typeof json?.warning === 'string' ? json.warning : '');
    } catch (error: any) {
      setAssistantWarning(error?.message || 'Failed to load assistant history.');
    } finally {
      setAssistantLoading(false);
    }
  }, []);

  const loadTickets = useCallback(async (token: string) => {
    setTicketsLoading(true);
    try {
      const res = await fetch('/api/support/tickets?limit=40', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load support tickets.');
      }
      const nextTickets = Array.isArray(json?.tickets) ? json.tickets : [];
      setTickets(nextTickets);
      setSupportWarning(typeof json?.warning === 'string' ? json.warning : '');
      if (!selectedTicketId && nextTickets.length > 0) {
        setSelectedTicketId(nextTickets[0].id);
      }
      if (selectedTicketId && !nextTickets.some((t: any) => t.id === selectedTicketId)) {
        setSelectedTicketId(nextTickets[0]?.id ?? null);
      }
    } catch (error: any) {
      setSupportWarning(error?.message || 'Failed to load support tickets.');
    } finally {
      setTicketsLoading(false);
    }
  }, [selectedTicketId]);

  const loadTicketMessages = useCallback(async (token: string, ticketId: string, silent = true) => {
    setTicketMessagesLoading(true);
    try {
      const res = await fetch(`/api/support/messages?ticketId=${ticketId}&limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to load ticket messages.');
      }
      setTicketMessages(Array.isArray(json?.messages) ? json.messages : []);
      setTicketMessagesWarning(typeof json?.warning === 'string' ? json.warning : '');
    } catch (error: any) {
      setTicketMessagesWarning(error?.message || 'Failed to load ticket messages.');
      if (!silent) {
        showToast({ type: 'error', title: 'Messages Load Failed', message: error?.message || 'Failed to load ticket messages.' });
      }
    } finally {
      setTicketMessagesLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    let active = true;
    const run = async () => {
      const token = await getAccessToken();
      if (!token) {
        router.push('/login');
        return;
      }
      if (!active) return;
      await Promise.all([loadAssistantHistory(token), loadTickets(token)]);
    };

    run();
    return () => {
      active = false;
    };
  }, [isAuthenticated, router, getAccessToken, loadAssistantHistory, loadTickets]);

  useEffect(() => {
    if (!selectedTicketId) {
      setTicketMessages([]);
      setTicketMessagesWarning('');
      return;
    }

    let active = true;
    const run = async () => {
      const token = await getAccessToken();
      if (!token || !active) return;
      await loadTicketMessages(token, selectedTicketId);
    };
    run();
    return () => {
      active = false;
    };
  }, [selectedTicketId, getAccessToken, loadTicketMessages]);

  useEffect(() => {
    const rawDraft = window.localStorage.getItem('vitar-care-ticket-draft');
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as Partial<typeof ticketForm>;
      setTicketForm((prev) => ({
        ...prev,
        subject: typeof draft.subject === 'string' ? draft.subject : prev.subject,
        category: typeof draft.category === 'string' ? draft.category : prev.category,
        priority: typeof draft.priority === 'string' ? draft.priority : prev.priority,
        description: typeof draft.description === 'string' ? draft.description : prev.description,
      }));
      showToast({
        type: 'info',
        title: 'Support Draft Ready',
        message: 'The assistant prepared a support ticket draft for you below.',
      });
    } catch {
      // ignore malformed draft
    } finally {
      window.localStorage.removeItem('vitar-care-ticket-draft');
    }
  }, [showToast]);

  const handleAssistantSend = async (e?: FormEvent, preset?: string) => {
    if (e) e.preventDefault();
    const nextMessage = (preset ?? assistantInput).trim();
    if (!nextMessage) return;

    setAssistantSending(true);
    setAssistantInput('');
    const optimisticId = Date.now();
    const optimistic: AssistantMessage = {
      id: optimisticId,
      role: 'user',
      message: nextMessage,
      createdAt: new Date().toISOString(),
    };
    setAssistantMessages((prev) => [...prev, optimistic]);

    try {
      const token = await getAccessToken();
      if (!token) {
        router.push('/login');
        return;
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
              id: Date.now(),
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

      if (normalizedReply) {
        setAssistantMessages((prev) => [...prev, normalizedReply]);
      }
    } catch (error: any) {
      setAssistantMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      setAssistantInput(nextMessage);
      showToast({ type: 'error', title: 'Assistant Error', message: error?.message || 'Assistant request failed.' });
    } finally {
      setAssistantSending(false);
    }
  };

  const submitAssistantFeedback = useCallback(
    async (assistantChatId: number | string, helpful: boolean) => {
      const key = String(assistantChatId);
      if (!/^\d+$/.test(key)) return;
      const comment = !helpful ? window.prompt('Optional: what should the assistant improve?', '') ?? '' : '';
      setAssistantFeedbackSubmitting((prev) => ({ ...prev, [key]: true }));
      try {
        const token = await getAccessToken();
        if (!token) {
          router.push('/login');
          return;
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
        setAssistantFeedbackGiven((prev) => ({ ...prev, [key]: true }));
        showToast({
          type: 'success',
          title: 'Feedback Saved',
          message: helpful ? 'Marked as helpful.' : 'Marked as not helpful.',
        });
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Feedback Failed',
          message: error?.message || 'Could not save feedback.',
        });
      } finally {
        setAssistantFeedbackSubmitting((prev) => ({ ...prev, [key]: false }));
      }
    },
    [getAccessToken, router, showToast],
  );

  const handleAssistantAction = async (action: NonNullable<AssistantMessage['actions']>[number]) => {
    if (action.type === 'open_dashboard') {
      router.push('/dashboard');
      return;
    }

    if (action.type === 'open_care_center') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (action.type === 'summarize_readings') {
      await handleAssistantSend(undefined, 'Summarize my latest heart readings.');
      return;
    }

    if (action.type === 'create_support_ticket' && action.payload) {
      if (action.payload.autoCreate) {
        try {
          const token = await getAccessToken();
          if (!token) {
            router.push('/login');
            return;
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
            message: 'The assistant created a support ticket for you.',
          });
          await loadTickets(token);
          if (json?.ticket?.id) {
            setSelectedTicketId(json.ticket.id);
            await loadTicketMessages(token, json.ticket.id, false);
          }
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

      setTicketForm((prev) => ({
        ...prev,
        subject: typeof action.payload?.subject === 'string' ? action.payload.subject : prev.subject,
        category: typeof action.payload?.category === 'string' ? action.payload.category : prev.category,
        priority: typeof action.payload?.priority === 'string' ? action.payload.priority : prev.priority,
        description: typeof action.payload?.description === 'string' ? action.payload.description : prev.description,
      }));
      showToast({
        type: 'info',
        title: 'Ticket Draft Added',
        message: 'The support ticket form below has been prefilled for you.',
      });
      const supportSection = document.querySelector('.support-card');
      supportSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCreateTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (ticketForm.subject.trim().length < 3 || ticketForm.description.trim().length < 10) {
      showToast({ type: 'error', title: 'Ticket Invalid', message: 'Add a clear subject and description.' });
      return;
    }

    setTicketSubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ticketForm),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to create ticket.');
      }

      setTicketForm({
        subject: '',
        category: 'general',
        priority: 'normal',
        description: '',
      });
      showToast({ type: 'success', title: 'Ticket Created' });
      await loadTickets(token);
      if (json?.ticket?.id) {
        setSelectedTicketId(json.ticket.id);
        await loadTicketMessages(token, json.ticket.id, false);
      }
    } catch (error: any) {
      showToast({ type: 'error', title: 'Support Error', message: error?.message || 'Failed to create ticket.' });
    } finally {
      setTicketSubmitting(false);
    }
  };

  const handleReply = async (e: FormEvent) => {
    e.preventDefault();
    const message = ticketReply.trim();
    if (!selectedTicketId || !message) return;

    setReplySubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch('/api/support/messages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ticketId: selectedTicketId, message }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to send message.');
      }

      setTicketReply('');
      await Promise.all([loadTicketMessages(token, selectedTicketId, false), loadTickets(token)]);
    } catch (error: any) {
      showToast({ type: 'error', title: 'Reply Failed', message: error?.message || 'Failed to send message.' });
    } finally {
      setReplySubmitting(false);
    }
  };

  return (
    <>
      <Cursors />
      <Navbar />
      <main className="care-center-page">
        <section className="care-hero-wrap">
          <div className="care-hero-copy">
            <div className="s-eye">CARE CENTER</div>
            <h1 className="care-title">
              Customer Support and <em>Health Assistant</em>
            </h1>
            <p className="care-sub">
              One place to talk to your cardiac assistant, raise support tickets, and track help requests with real-time updates.
            </p>
            <div className="care-badges">
              <span>24/7 triage guidance</span>
              <span>Ticket tracking</span>
              <span>Secure health context</span>
            </div>
          </div>
          <Heart3D />
        </section>

        <section className="care-grid">
          <article className="care-card assistant-card">
            <div className="care-card-head">
              <h2>Health Assistant</h2>
              <span className="status-pill online">Online</span>
            </div>

            {assistantWarning && <p className="muted" style={{ color: '#E67E22' }}>{assistantWarning}</p>}
            {assistantWarning && (
              <button type="button" onClick={() => void (async () => {
                const token = await getAccessToken();
                if (!token) return;
                await loadAssistantHistory(token);
              })()}>
                Retry loading assistant
              </button>
            )}

            <div className="assistant-quick-prompts">
              {quickPrompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => handleAssistantSend(undefined, prompt)}>
                  {prompt}
                </button>
              ))}
            </div>

            <div className="assistant-log">
              {assistantLoading ? (
                <p className="muted">Loading assistant history...</p>
              ) : assistantMessages.length === 0 ? (
                <p className="muted">No conversation yet. Ask your first health question.</p>
              ) : (
                assistantMessages.map((msg) => (
                  <div key={msg.id} className={`assistant-msg ${msg.role === 'assistant' ? 'assistant' : 'user'}`}>
                    <div className="assistant-msg-head">
                      <strong>{msg.role === 'assistant' ? 'VITAR Assistant' : 'You'}</strong>
                      <time>{new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</time>
                    </div>
                    {msg.role === 'assistant' && (msg.title || msg.mode) ? (
                      <div className="assistant-msg-meta">
                        {msg.title ? <span className="assistant-msg-title">{msg.title}</span> : null}
                        {msg.mode ? (
                          <span className="assistant-msg-mode">
                            {msg.mode.replace(/_/g, ' ')}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    {msg.role === 'assistant' && msg.summary ? (
                      <div className="assistant-msg-summary">{msg.summary}</div>
                    ) : null}
                    <p>{msg.message}</p>
                    {msg.role === 'assistant' && typeof msg.confidence === 'number' ? (
                      <div className="assistant-msg-confidence">Confidence {Math.round(msg.confidence * 100)}%</div>
                    ) : null}
                    {msg.role === 'assistant' && Array.isArray(msg.sections) && msg.sections.length > 0 ? (
                      <div className="assistant-msg-sections">
                        {msg.sections.slice(0, 3).map((section) => (
                          <div key={`${msg.id}-${section.label}`} className="assistant-msg-section">
                            <strong>{section.label}</strong>
                            <p>{section.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {msg.role === 'assistant' && Array.isArray(msg.nextSteps) && msg.nextSteps.length > 0 ? (
                      <ul className="assistant-msg-steps">
                        {msg.nextSteps.slice(0, 3).map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                    ) : null}
                    {msg.role === 'assistant' && Array.isArray(msg.actions) && msg.actions.length > 0 ? (
                      <div className="assistant-msg-actions">
                        {msg.actions.map((action) => (
                          <button
                            key={`${msg.id}-${action.type}-${action.label}`}
                            type="button"
                            onClick={() => void handleAssistantAction(action)}
                            className="assistant-msg-action"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {msg.role === 'assistant' ? (
                      <div className="assistant-msg-feedback">
                        <button
                          type="button"
                          onClick={() => void submitAssistantFeedback(msg.id, true)}
                          disabled={assistantFeedbackSubmitting[String(msg.id)] || assistantFeedbackGiven[String(msg.id)]}
                        >
                          Helpful
                        </button>
                        <button
                          type="button"
                          onClick={() => void submitAssistantFeedback(msg.id, false)}
                          disabled={assistantFeedbackSubmitting[String(msg.id)] || assistantFeedbackGiven[String(msg.id)]}
                        >
                          Not Helpful
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <form className="assistant-input" onSubmit={handleAssistantSend}>
              <input
                value={assistantInput}
                onChange={(e) => setAssistantInput(e.target.value)}
                placeholder="Describe your symptoms or ask a care question..."
              />
              <button type="submit" disabled={assistantSending}>
                {assistantSending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </article>

          <article className="care-card support-card">
            <div className="care-card-head">
              <h2>Customer Support</h2>
              <span className="status-pill">Ticketed</span>
            </div>

            {supportWarning && <p className="muted" style={{ color: '#E67E22' }}>{supportWarning}</p>}

            <form className="ticket-create" onSubmit={handleCreateTicket}>
              <input
                value={ticketForm.subject}
                onChange={(e) => setTicketForm((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Ticket subject"
              />
              <div className="ticket-create-row">
                <select
                  value={ticketForm.category}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, category: e.target.value }))}
                >
                  <option value="general">General</option>
                  <option value="technical">Technical</option>
                  <option value="device">Device</option>
                  <option value="billing">Billing</option>
                  <option value="medical">Medical</option>
                </select>
                <select
                  value={ticketForm.priority}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, priority: e.target.value }))}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <textarea
                value={ticketForm.description}
                onChange={(e) => setTicketForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={4}
                placeholder="Describe your issue in detail..."
              />
              <button type="submit" disabled={ticketSubmitting}>
                {ticketSubmitting ? 'Creating...' : 'Create Ticket'}
              </button>
            </form>

            <div className="ticket-layout">
              <div className="ticket-list">
                {ticketsLoading ? (
                  <p className="muted">Loading tickets...</p>
                ) : tickets.length === 0 ? (
                  <p className="muted">No tickets yet.</p>
                ) : (
                  tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      className={`ticket-item ${selectedTicketId === ticket.id ? 'active' : ''}`}
                      onClick={() => setSelectedTicketId(ticket.id)}
                    >
                      <div className="ticket-top">
                        <strong>{ticket.subject}</strong>
                        <span className={`status-pill ${ticket.status}`}>{ticket.status.replace('_', ' ')}</span>
                      </div>
                      <div className="ticket-meta">
                        <span>{ticket.category}</span>
                        <span>{ticket.priority}</span>
                        <span>{ticket.messageCount} msg</span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="ticket-chat">
                {!selectedTicket ? (
                  <p className="muted">Select a ticket to view conversation.</p>
                ) : (
                  <>
                    <div className="ticket-chat-head">
                      <strong>{selectedTicket.subject}</strong>
                      <span className={`status-pill ${selectedTicket.status}`}>{selectedTicket.status.replace('_', ' ')}</span>
                    </div>
                    {ticketMessagesWarning && <p className="muted" style={{ color: '#E67E22', marginBottom: '.55rem' }}>{ticketMessagesWarning}</p>}

                    <div className="ticket-chat-log">
                      {ticketMessagesLoading ? (
                        <p className="muted">Loading messages...</p>
                      ) : ticketMessages.length === 0 ? (
                        <p className="muted">No messages yet.</p>
                      ) : (
                        ticketMessages.map((message) => (
                          <div key={message.id} className={`ticket-msg ${message.senderType === 'support' ? 'support' : 'user'}`}>
                            <div className="assistant-msg-head">
                              <strong>{message.senderType === 'support' ? 'Support Team' : 'You'}</strong>
                              <time>{new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</time>
                            </div>
                            <p>{message.message}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <form className="ticket-reply" onSubmit={handleReply}>
                      <input
                        value={ticketReply}
                        onChange={(e) => setTicketReply(e.target.value)}
                        placeholder="Reply to this ticket..."
                        disabled={selectedTicket.status === 'closed'}
                      />
                      <button type="submit" disabled={replySubmitting || selectedTicket.status === 'closed'}>
                        {replySubmitting ? 'Sending...' : 'Reply'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </article>
        </section>
      </main>
      <Footer />
    </>
  );
}
