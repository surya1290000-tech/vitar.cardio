'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

type AdminSupportTicket = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  subject: string;
  category: string;
  priority: TicketPriority;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessageAt: string | null;
};

type AdminSupportMessage = {
  id: number;
  ticketId: string;
  senderType: 'user' | 'support' | string;
  message: string;
  createdAt: string;
};

type SupportAutomationDraft = {
  suggestedCategory: string | null;
  suggestedPriority: string | null;
  originalCategory: string | null;
  originalPriority: string | null;
  draftReply: string | null;
  summary: string;
  severity: string;
  createdAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

const statusOptions: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
const priorityOptions: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

export default function AdminSupportPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [authed, setAuthed] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [tickets, setTickets] = useState<AdminSupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminSupportMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [automationDraft, setAutomationDraft] = useState<SupportAutomationDraft | null>(null);
  const [reply, setReply] = useState('');
  const [replyStatus, setReplyStatus] = useState<TicketStatus>('in_progress');
  const [replying, setReplying] = useState(false);

  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TicketPriority>('all');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId]
  );

  const loadTickets = useCallback(
    async (page = 1) => {
      setTicketsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pagination.limit),
        });
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (priorityFilter !== 'all') params.set('priority', priorityFilter);
        if (search.trim()) params.set('search', search.trim());

        const res = await fetch(`/api/admin/support/tickets?${params.toString()}`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            setAuthed(false);
            return;
          }
          throw new Error(json?.error || 'Failed to load support tickets.');
        }

        const nextTickets = Array.isArray(json?.tickets) ? json.tickets : [];
        setTickets(nextTickets);
        if (json?.pagination) setPagination(json.pagination);

        if (nextTickets.length === 0) {
          setSelectedTicketId(null);
          setMessages([]);
          setAutomationDraft(null);
          return;
        }

        if (!selectedTicketId || !nextTickets.some((t: AdminSupportTicket) => t.id === selectedTicketId)) {
          setSelectedTicketId(nextTickets[0].id);
        }
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Support Load Failed',
          message: error?.message || 'Failed to load support tickets.',
        });
      } finally {
        setTicketsLoading(false);
      }
    },
    [pagination.limit, priorityFilter, search, selectedTicketId, showToast, statusFilter]
  );

  const loadMessages = useCallback(
    async (ticketId: string) => {
      setMessagesLoading(true);
      try {
        const res = await fetch(`/api/admin/support/messages?ticketId=${ticketId}&limit=400`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            setAuthed(false);
            return;
          }
          throw new Error(json?.error || 'Failed to load messages.');
        }
        setMessages(Array.isArray(json?.messages) ? json.messages : []);
        setAutomationDraft(json?.automation ?? null);
        if (json?.ticket?.status) {
          setReplyStatus(json.ticket.status);
        }
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Message Load Failed',
          message: error?.message || 'Failed to load messages.',
        });
      } finally {
        setMessagesLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/admin/auth/session', { credentials: 'include' });
        const json = await res.json();
        if (res.ok && json?.authenticated) {
          setAuthed(true);
          await loadTickets(1);
        }
      } catch {
        // manual login fallback
      } finally {
        setCheckingSession(false);
      }
    };
    run();
  }, [loadTickets]);

  useEffect(() => {
    if (!authed || !selectedTicketId) return;
    void loadMessages(selectedTicketId);
  }, [authed, selectedTicketId, loadMessages]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAuthError(json?.error || 'Failed to sign in.');
        return;
      }
      setAuthed(true);
      setPassword('');
      await loadTickets(1);
      showToast({ type: 'success', title: 'Admin Signed In' });
    } catch {
      setAuthError('Network error while signing in.');
    } finally {
      setAuthLoading(false);
    }
  };

  const updateTicketMeta = async (ticketId: string, patch: { status?: TicketStatus; priority?: TicketPriority }) => {
    try {
      const res = await fetch('/api/admin/support/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ticketId, ...patch }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to update ticket.');
      }
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t))
      );
      showToast({ type: 'success', title: 'Ticket Updated' });
    } catch (error: any) {
      showToast({ type: 'error', title: 'Update Failed', message: error?.message || 'Failed to update ticket.' });
    }
  };

  const handleReply = async (e: FormEvent) => {
    e.preventDefault();
    const message = reply.trim();
    if (!selectedTicketId || !message) return;

    setReplying(true);
    try {
      const res = await fetch('/api/admin/support/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ticketId: selectedTicketId, message, status: replyStatus }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to send reply.');
      }

      setReply('');
      setAutomationDraft(null);
      await Promise.all([loadMessages(selectedTicketId), loadTickets(pagination.page)]);
      showToast({ type: 'success', title: 'Reply Sent' });
    } catch (error: any) {
      showToast({ type: 'error', title: 'Reply Failed', message: error?.message || 'Failed to send reply.' });
    } finally {
      setReplying(false);
    }
  };

  if (checkingSession) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--deep)', color: 'var(--white)' }}>
        Checking admin session...
      </div>
    );
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--deep)', color: 'var(--white)' }}>
        <form
          onSubmit={handleLogin}
          style={{ width: '100%', maxWidth: 420, background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: 10, padding: '2rem' }}
        >
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.9rem', marginBottom: '.4rem' }}>Support Admin</h1>
          <p style={{ color: 'var(--muted)', marginBottom: '1.2rem' }}>Sign in to manage customer support tickets.</p>
          {authError && (
            <div style={{ color: '#E74C3C', fontSize: '.86rem', marginBottom: '.8rem' }}>
              {authError}
            </div>
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            style={{
              width: '100%',
              padding: '.82rem .9rem',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--deep)',
              color: 'var(--white)',
              marginBottom: '.9rem',
            }}
          />
          <button
            type="submit"
            disabled={authLoading}
            style={{
              width: '100%',
              padding: '.82rem',
              borderRadius: 8,
              border: 'none',
              background: '#C0392B',
              color: '#fff',
              cursor: authLoading ? 'not-allowed' : 'pointer',
              opacity: authLoading ? 0.72 : 1,
            }}
          >
            {authLoading ? 'Signing in...' : 'Access Support'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--deep)', color: 'var(--white)', padding: '1.2rem 1.2rem 2rem' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem' }}>Support Operations</h1>
            <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>Manage tickets, assign status, and send care responses.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/admin/automation')}
            style={{ border: '1px solid rgba(47,128,237,0.28)', background: 'rgba(47,128,237,0.12)', color: '#D8E8FF', borderRadius: 8, padding: '.6rem .9rem' }}
          >
            Automation Studio
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin')}
            style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--white)', borderRadius: 8, padding: '.6rem .9rem' }}
          >
            Back to Admin
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '430px 1fr', gap: '1rem' }}>
          <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: 10, minHeight: 700, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '.8rem', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subject/email"
                style={{ gridColumn: '1 / -1', padding: '.58rem .7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--deep)', color: 'var(--white)' }}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | TicketStatus)}
                style={{ padding: '.58rem .7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--deep)', color: 'var(--white)' }}
              >
                <option value="all">All status</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as 'all' | TicketPriority)}
                style={{ padding: '.58rem .7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--deep)', color: 'var(--white)' }}
              >
                <option value="all">All priority</option>
                {priorityOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => loadTickets(1)}
                disabled={ticketsLoading}
                style={{ gridColumn: '1 / -1', padding: '.58rem .7rem', borderRadius: 8, border: 'none', background: '#C0392B', color: '#fff', cursor: ticketsLoading ? 'not-allowed' : 'pointer', opacity: ticketsLoading ? 0.7 : 1 }}
              >
                {ticketsLoading ? 'Loading...' : 'Apply Filters'}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '.6rem' }}>
              {tickets.length === 0 ? (
                <p style={{ color: 'var(--muted)', padding: '.7rem' }}>No tickets found.</p>
              ) : (
                tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: selectedTicketId === ticket.id ? '1px solid rgba(192,57,43,.5)' : '1px solid var(--border)',
                      background: selectedTicketId === ticket.id ? 'rgba(192,57,43,.1)' : 'rgba(255,255,255,.02)',
                      borderRadius: 8,
                      padding: '.7rem',
                      marginBottom: '.55rem',
                      color: 'var(--white)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: '.86rem', lineHeight: 1.35 }}>{ticket.subject}</strong>
                      <span style={{ fontSize: '.68rem', color: 'var(--muted)', textTransform: 'uppercase' }}>{ticket.status.replace('_', ' ')}</span>
                    </div>
                    <div style={{ marginTop: '.4rem', fontSize: '.76rem', color: 'var(--muted)' }}>
                      {ticket.userEmail}
                    </div>
                    <div style={{ marginTop: '.35rem', display: 'flex', gap: '.55rem', fontSize: '.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      <span>{ticket.category}</span>
                      <span>{ticket.priority}</span>
                      <span>{ticket.messageCount} msg</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', padding: '.6rem', display: 'flex', justifyContent: 'space-between', gap: '.5rem' }}>
              <button
                type="button"
                onClick={() => loadTickets(pagination.page - 1)}
                disabled={!pagination.hasPrevPage || ticketsLoading}
                style={{ flex: 1, padding: '.5rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--white)', opacity: !pagination.hasPrevPage ? 0.5 : 1 }}
              >
                Prev
              </button>
              <div style={{ color: 'var(--muted)', fontSize: '.76rem', alignSelf: 'center' }}>
                {pagination.page}/{pagination.totalPages}
              </div>
              <button
                type="button"
                onClick={() => loadTickets(pagination.page + 1)}
                disabled={!pagination.hasNextPage || ticketsLoading}
                style={{ flex: 1, padding: '.5rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--white)', opacity: !pagination.hasNextPage ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>

          <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: 10, minHeight: 700, display: 'flex', flexDirection: 'column' }}>
            {!selectedTicket ? (
              <div style={{ padding: '1rem', color: 'var(--muted)' }}>Select a ticket to open thread.</div>
            ) : (
              <>
                <div style={{ padding: '.9rem 1rem', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ fontSize: '1rem', marginBottom: '.25rem' }}>{selectedTicket.subject}</h2>
                      <p style={{ color: 'var(--muted)', fontSize: '.8rem' }}>
                        {selectedTicket.userName || selectedTicket.userEmail} ({selectedTicket.userEmail})
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '.5rem' }}>
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => {
                          const status = e.target.value as TicketStatus;
                          void updateTicketMeta(selectedTicket.id, { status });
                        }}
                        style={{ padding: '.45rem .6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--deep)', color: 'var(--white)' }}
                      >
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {s.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedTicket.priority}
                        onChange={(e) => {
                          const priority = e.target.value as TicketPriority;
                          void updateTicketMeta(selectedTicket.id, { priority });
                        }}
                        style={{ padding: '.45rem .6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--deep)', color: 'var(--white)' }}
                      >
                        {priorityOptions.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: '.83rem', marginTop: '.65rem' }}>{selectedTicket.description}</p>
                  {automationDraft && (
                    <div
                      style={{
                        marginTop: '.85rem',
                        background: 'rgba(93, 173, 226, 0.08)',
                        border: '1px solid rgba(93, 173, 226, 0.22)',
                        borderRadius: 10,
                        padding: '.85rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '.72rem', color: '#5DADE2', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.35rem' }}>
                            AI Reply Workflow
                          </div>
                          <div style={{ fontSize: '.82rem', color: 'var(--muted)', lineHeight: 1.65 }}>
                            {automationDraft.summary}
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: '.68rem',
                            padding: '.24rem .7rem',
                            borderRadius: 999,
                            background:
                              automationDraft.severity === 'urgent'
                                ? 'rgba(231,76,60,0.14)'
                                : automationDraft.severity === 'high'
                                  ? 'rgba(243,156,18,0.14)'
                                  : 'rgba(46,204,113,0.12)',
                            color:
                              automationDraft.severity === 'urgent'
                                ? '#E74C3C'
                                : automationDraft.severity === 'high'
                                  ? '#F39C12'
                                  : '#2ECC71',
                            border: `1px solid ${
                              automationDraft.severity === 'urgent'
                                ? 'rgba(231,76,60,0.24)'
                                : automationDraft.severity === 'high'
                                  ? 'rgba(243,156,18,0.24)'
                                  : 'rgba(46,204,113,0.24)'
                            }`,
                            textTransform: 'uppercase',
                          }}
                        >
                          {automationDraft.severity}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '.65rem', flexWrap: 'wrap', marginTop: '.7rem', fontSize: '.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        {automationDraft.originalCategory && automationDraft.suggestedCategory && (
                          <span>Category: {automationDraft.originalCategory} → {automationDraft.suggestedCategory}</span>
                        )}
                        {automationDraft.originalPriority && automationDraft.suggestedPriority && (
                          <span>Priority: {automationDraft.originalPriority} → {automationDraft.suggestedPriority}</span>
                        )}
                      </div>

                      {automationDraft.draftReply && (
                        <>
                          <div
                            style={{
                              marginTop: '.75rem',
                              background: 'rgba(255,255,255,.03)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              padding: '.75rem',
                              fontSize: '.84rem',
                              lineHeight: 1.7,
                            }}
                          >
                            {automationDraft.draftReply}
                          </div>
                          <div style={{ display: 'flex', gap: '.55rem', flexWrap: 'wrap', marginTop: '.7rem' }}>
                            <button
                              type="button"
                              onClick={() => setReply(automationDraft.draftReply ?? '')}
                              style={{
                                padding: '.55rem .8rem',
                                borderRadius: 8,
                                border: 'none',
                                background: '#C0392B',
                                color: '#fff',
                                cursor: 'pointer',
                              }}
                            >
                              Use AI Draft
                            </button>
                            {automationDraft.suggestedPriority && automationDraft.suggestedPriority !== selectedTicket.priority && (
                              <button
                                type="button"
                                onClick={() => void updateTicketMeta(selectedTicket.id, { priority: automationDraft.suggestedPriority as TicketPriority })}
                                style={{
                                  padding: '.55rem .8rem',
                                  borderRadius: 8,
                                  border: '1px solid var(--border)',
                                  background: 'transparent',
                                  color: 'var(--white)',
                                  cursor: 'pointer',
                                }}
                              >
                                Apply Suggested Priority
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '.8rem', display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
                  {messagesLoading ? (
                    <p style={{ color: 'var(--muted)' }}>Loading messages...</p>
                  ) : messages.length === 0 ? (
                    <p style={{ color: 'var(--muted)' }}>No messages yet.</p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: msg.senderType === 'support' ? 'flex-end' : 'flex-start',
                          maxWidth: '82%',
                          background: msg.senderType === 'support' ? 'rgba(192,57,43,.14)' : 'rgba(255,255,255,.04)',
                          border: msg.senderType === 'support' ? '1px solid rgba(192,57,43,.4)' : '1px solid var(--border)',
                          borderRadius: 10,
                          padding: '.65rem .72rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.8rem', color: 'var(--muted)', fontSize: '.67rem', marginBottom: '.35rem' }}>
                          <span>{msg.senderType === 'support' ? 'Support' : 'User'}</span>
                          <time>{new Date(msg.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</time>
                        </div>
                        <p style={{ fontSize: '.84rem', lineHeight: 1.55 }}>{msg.message}</p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleReply} style={{ borderTop: '1px solid var(--border)', padding: '.8rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '.55rem' }}>
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write support reply..."
                    style={{ gridColumn: '1 / -1', padding: '.72rem .8rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--deep)', color: 'var(--white)' }}
                  />
                  <select
                    value={replyStatus}
                    onChange={(e) => setReplyStatus(e.target.value as TicketStatus)}
                    style={{ padding: '.62rem .7rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--deep)', color: 'var(--white)' }}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        Set {s.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={replying || reply.trim().length === 0}
                    style={{ padding: '.62rem .85rem', borderRadius: 8, border: 'none', background: '#C0392B', color: '#fff', cursor: replying ? 'not-allowed' : 'pointer', opacity: replying ? 0.72 : 1 }}
                  >
                    {replying ? 'Sending...' : 'Send Reply'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
