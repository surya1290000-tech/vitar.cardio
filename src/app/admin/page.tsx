'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_verified: boolean;
  role: string;
  created_at: string;
}

interface Order {
  id: string;
  order_number: string;
  email: string;
  first_name: string;
  last_name: string;
  device_model: string;
  status: string;
  payment_status?: string | null;
  total: number;
  created_at: string;
}

interface Stats {
  totalUsers: number;
  verifiedUsers: number;
  totalOrders: number;
  totalRevenue: number;
  totalPayments?: number;
  totalAlerts?: number;
  criticalAlerts?: number;
  confirmedWithoutPayment?: number;
  orphanPayments?: number;
  capturedPayments?: number;
  pendingCapturePayments?: number;
  payoutReadyPayments?: number;
}

interface Payment {
  id: string;
  order_id: string | null;
  user_id: string;
  stripe_payment_intent_id: string | null;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  created_at: string;
  payout_ready?: boolean;
}

interface AlertItem {
  id: string;
  user_id: string;
  device_id: string | null;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  created_at: string;
  resolved_at: string | null;
}

interface AdminAuthLog {
  id: number;
  action: 'login_success' | 'login_failed' | 'login_blocked' | 'logout' | string;
  ip_address: string | null;
  user_agent: string | null;
  details: string | null;
  created_at: string;
}

interface Reconciliation {
  confirmedWithoutPayment: number;
  orphanPayments: number;
}

type DateRange = 'all' | '24h' | '7d' | '30d';

export default function AdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'users' | 'orders' | 'ops'>('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [adminAuthLogs, setAdminAuthLogs] = useState<AdminAuthLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'authorized' | 'failed' | 'other'>('all');
  const [alertFilter, setAlertFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [paymentDateRange, setPaymentDateRange] = useState<DateRange>('all');
  const [alertDateRange, setAlertDateRange] = useState<DateRange>('all');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [orderActionLoadingId, setOrderActionLoadingId] = useState<string | null>(null);
  const [orderActionMessage, setOrderActionMessage] = useState('');
  const [orderActionError, setOrderActionError] = useState('');

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setAuthed(false);
      setPassword('');
      setUsers([]);
      setOrders([]);
      setPayments([]);
      setAlerts([]);
      setAdminAuthLogs([]);
      setStats(null);
      setReconciliation(null);
      setLoadError('');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Failed to sign in.');
        return;
      }
      setAuthed(true);
      await loadData();
    } catch {
      setError('Network error while signing in.');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/admin/data', {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok) {
        setUsers(json.users || []);
        setOrders(json.orders || []);
        setPayments(json.payments || []);
        setAlerts(json.alerts || []);
        setAdminAuthLogs(json.adminAuthLogs || []);
        setStats(json.stats || null);
        setReconciliation(json.reconciliation || null);
      } else {
        if (res.status === 401) {
          setAuthed(false);
        }
        setLoadError(json?.error || 'Failed to load admin data.');
      }
    } catch (err) {
      console.error(err);
      setLoadError('Network error while loading admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      try {
        const res = await fetch('/api/admin/auth/session', { credentials: 'include' });
        const json = await res.json();
        if (!active) return;
        if (res.ok && json?.authenticated) {
          setAuthed(true);
          await loadData();
        }
      } catch {
        // No-op: user can still login manually.
      }
    };
    checkSession();
    return () => {
      active = false;
    };
  }, []);

  const inRange = (dateString: string, range: DateRange) => {
    if (range === 'all') return true;
    const d = new Date(dateString).getTime();
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    if (range === '24h') return now - d <= oneDay;
    if (range === '7d') return now - d <= 7 * oneDay;
    return now - d <= 30 * oneDay;
  };

  const filteredPayments = payments.filter(p => {
    if (!inRange(p.created_at, paymentDateRange)) return false;
    if (paymentFilter === 'all') return true;
    if (paymentFilter === 'authorized') return p.status === 'authorized';
    if (paymentFilter === 'failed') return ['failed', 'payment_failed'].includes(p.status);
    return !['authorized', 'failed', 'payment_failed'].includes(p.status);
  });

  const filteredAlerts = alerts.filter(a => {
    if (!inRange(a.created_at, alertDateRange)) return false;
    return alertFilter === 'all' ? true : a.severity === alertFilter;
  });

  const orderPaymentBadge = (order: Order) => {
    const status = order.payment_status;
    if (status === 'captured' || status === 'succeeded' || status === 'paid') {
      return { label: 'Captured', bg: 'rgba(46,204,113,0.1)', color: '#2ECC71', border: 'rgba(46,204,113,0.3)' };
    }
    if (status === 'authorized') {
      return { label: 'Authorized', bg: 'rgba(243,156,18,0.1)', color: '#F39C12', border: 'rgba(243,156,18,0.3)' };
    }
    if (order.status === 'confirmed') {
      return { label: 'Missing', bg: 'rgba(231,76,60,0.1)', color: '#E74C3C', border: 'rgba(231,76,60,0.3)' };
    }
    return { label: 'Pending', bg: 'rgba(255,255,255,0.05)', color: '#8A8A8E', border: 'rgba(255,255,255,0.12)' };
  };

  const runOrderAction = async (orderId: string, action: 'capture' | 'ship') => {
    setOrderActionLoadingId(orderId);
    setOrderActionMessage('');
    setOrderActionError('');
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOrderActionError(json?.error || 'Failed to process action.');
        return;
      }
      setOrderActionMessage(json?.message || 'Order updated.');
      await loadData();
    } catch {
      setOrderActionError('Network error while updating order.');
    } finally {
      setOrderActionLoadingId(null);
    }
  };

  if (!authed) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0D0D0F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
          <div
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '1.5rem',
              letterSpacing: '0.12em',
              color: '#F9F8F6',
              marginBottom: '2.5rem',
            }}
          >
            VITAR<span style={{ color: '#C0392B' }}>.</span>
            <span
              style={{
                fontSize: '0.75rem',
                color: '#8A8A8E',
                letterSpacing: '0.2em',
                marginLeft: '0.8rem',
                fontFamily: 'DM Sans',
              }}
            >
              ADMIN
            </span>
          </div>

          <div
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '2.5rem',
            }}
          >
            <h1
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: '1.6rem',
                color: '#F9F8F6',
                marginBottom: '0.4rem',
              }}
            >
              Admin Access
            </h1>
            <p style={{ fontSize: '0.82rem', color: '#8A8A8E', marginBottom: '2rem' }}>
              Restricted area - authorised personnel only
            </p>

            {error && (
              <div
                style={{
                  background: 'rgba(192,57,43,0.1)',
                  border: '1px solid rgba(192,57,43,0.3)',
                  borderRadius: '4px',
                  padding: '0.8rem 1rem',
                  fontSize: '0.82rem',
                  color: '#E74C3C',
                  marginBottom: '1.2rem',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.72rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#8A8A8E',
                    marginBottom: '0.4rem',
                  }}
                >
                  Admin Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter admin password"
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    background: '#0D0D0F',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '3px',
                    padding: '0.85rem 1rem',
                    color: '#F9F8F6',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  background: '#C0392B',
                  color: '#F9F8F6',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '0.95rem',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Checking...' : 'Access Dashboard'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D0F', fontFamily: "'DM Sans', sans-serif", color: '#F9F8F6' }}>
      <nav
        style={{
          padding: '0 2rem',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#1A1A1C',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.2rem', letterSpacing: '0.12em' }}>
          VITAR<span style={{ color: '#C0392B' }}>.</span>
          <span
            style={{
              fontSize: '0.65rem',
              color: '#8A8A8E',
              letterSpacing: '0.2em',
              marginLeft: '0.8rem',
              fontFamily: 'DM Sans',
            }}
          >
            ADMIN PORTAL
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={loadData}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '3px',
              padding: '0.4rem 1rem',
              color: '#F9F8F6',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '3px',
              padding: '0.4rem 1rem',
              color: '#8A8A8E',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            Back to Site
          </button>
          <button
            onClick={handleAdminLogout}
            style={{
              background: 'rgba(192,57,43,0.1)',
              border: '1px solid rgba(192,57,43,0.3)',
              borderRadius: '3px',
              padding: '0.4rem 1rem',
              color: '#C0392B',
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '2rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            paddingBottom: '0',
          }}
        >
          {(['overview', 'users', 'orders', 'ops'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid #C0392B' : '2px solid transparent',
                color: tab === t ? '#F9F8F6' : '#8A8A8E',
                padding: '0.8rem 1.5rem',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.85rem',
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontWeight: tab === t ? 500 : 400,
                letterSpacing: '0.05em',
                marginBottom: '-1px',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign: 'center', color: '#8A8A8E', padding: '4rem' }}>Loading data...</div>}
        {!loading && loadError && (
          <div
            style={{
              background: 'rgba(192,57,43,0.1)',
              border: '1px solid rgba(192,57,43,0.3)',
              borderRadius: '6px',
              padding: '0.9rem 1rem',
              color: '#E74C3C',
              fontSize: '0.82rem',
              marginBottom: '1rem',
            }}
          >
            {loadError}
          </div>
        )}

        {!loading && tab === 'overview' && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem',
              }}
            >
              {[
                { label: 'Total Users', value: stats?.totalUsers ?? users.length, color: '#F9F8F6' },
                {
                  label: 'Verified Users',
                  value: stats?.verifiedUsers ?? users.filter(u => u.is_verified).length,
                  color: '#2ECC71',
                },
                { label: 'Total Orders', value: stats?.totalOrders ?? orders.length, color: '#3498DB' },
                { label: 'Revenue (hold)', value: `$${((stats?.totalRevenue ?? 0) / 100).toFixed(2)}`, color: '#C0392B' },
                { label: 'Payments Logged', value: stats?.totalPayments ?? payments.length, color: '#1ABC9C' },
                { label: 'Captured Payments', value: stats?.capturedPayments ?? 0, color: '#2ECC71' },
                { label: 'Pending Capture', value: stats?.pendingCapturePayments ?? 0, color: '#F39C12' },
                { label: 'Payout Ready', value: stats?.payoutReadyPayments ?? 0, color: '#16A085' },
                { label: 'Critical Alerts', value: stats?.criticalAlerts ?? alerts.filter(a => a.severity === 'critical').length, color: '#E74C3C' },
                { label: 'Confirmed w/o Payment', value: stats?.confirmedWithoutPayment ?? reconciliation?.confirmedWithoutPayment ?? 0, color: '#F39C12' },
                { label: 'Orphan Payments', value: stats?.orphanPayments ?? reconciliation?.orphanPayments ?? 0, color: '#9B59B6' },
              ].map((card, i) => (
                <div
                  key={i}
                  style={{
                    background: '#1A1A1C',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '1.5rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.68rem',
                      color: '#8A8A8E',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      marginBottom: '0.8rem',
                    }}
                  >
                    {card.label}
                  </div>
                  <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.5rem', color: card.color, lineHeight: 1 }}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                background: '#1A1A1C',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '1.5rem',
                marginBottom: '1rem',
              }}
            >
              <h3
                style={{
                  fontSize: '0.82rem',
                  color: '#8A8A8E',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: '1.2rem',
                }}
              >
                Recent Signups
              </h3>
              {users.slice(0, 5).map((u, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.8rem 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>
                      {u.first_name} {u.last_name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#8A8A8E' }}>{u.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '20px',
                        background: u.is_verified ? 'rgba(46,204,113,0.1)' : 'rgba(255,255,255,0.05)',
                        color: u.is_verified ? '#2ECC71' : '#8A8A8E',
                        border: `1px solid ${u.is_verified ? 'rgba(46,204,113,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      {u.is_verified ? 'Verified' : 'Unverified'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#8A8A8E' }}>{new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {users.length === 0 && <p style={{ color: '#8A8A8E', fontSize: '0.85rem' }}>No users yet.</p>}
            </div>
          </div>
        )}

        {!loading && tab === 'users' && (
          <div style={{ background: '#1A1A1C', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
            <div
              style={{
                padding: '1.2rem 1.5rem',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: '0.82rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                All Users ({users.length})
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Name', 'Email', 'Role', 'Status', 'Joined'].map(h => (
                      <th
                        key={h}
                        style={{
                          padding: '0.8rem 1.5rem',
                          textAlign: 'left',
                          fontSize: '0.68rem',
                          color: '#8A8A8E',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          fontWeight: 500,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>
                        {u.first_name} {u.last_name}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: '#8A8A8E' }}>{u.email}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '20px',
                            background: u.role === 'admin' ? 'rgba(192,57,43,0.1)' : 'rgba(255,255,255,0.05)',
                            color: u.role === 'admin' ? '#C0392B' : '#8A8A8E',
                            border: `1px solid ${u.role === 'admin' ? 'rgba(192,57,43,0.3)' : 'rgba(255,255,255,0.08)'}`,
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '20px',
                            background: u.is_verified ? 'rgba(46,204,113,0.1)' : 'rgba(255,193,7,0.1)',
                            color: u.is_verified ? '#2ECC71' : '#FFC107',
                            border: `1px solid ${u.is_verified ? 'rgba(46,204,113,0.3)' : 'rgba(255,193,7,0.3)'}`,
                          }}
                        >
                          {u.is_verified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: '#8A8A8E', fontSize: '0.78rem' }}>
                        {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <p style={{ color: '#8A8A8E', fontSize: '0.85rem', padding: '2rem 1.5rem' }}>No users yet.</p>}
            </div>
          </div>
        )}

        {!loading && tab === 'orders' && (
          <div style={{ background: '#1A1A1C', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ fontSize: '0.82rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                All Orders ({orders.length})
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Order #', 'Customer', 'Device', 'Order Status', 'Payment Status', 'Total', 'Date', 'Action'].map(h => (
                      <th
                        key={h}
                        style={{
                          padding: '0.8rem 1.5rem',
                          textAlign: 'left',
                          fontSize: '0.68rem',
                          color: '#8A8A8E',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          fontWeight: 500,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#C0392B' }}>
                        {o.order_number}
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ fontWeight: 500 }}>
                          {o.first_name} {o.last_name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#8A8A8E' }}>{o.email}</div>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: '#8A8A8E' }}>VITAR {o.device_model}</td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '20px',
                            background: o.status === 'confirmed' ? 'rgba(46,204,113,0.1)' : 'rgba(255,193,7,0.1)',
                            color: o.status === 'confirmed' ? '#2ECC71' : '#FFC107',
                            border: `1px solid ${o.status === 'confirmed' ? 'rgba(46,204,113,0.3)' : 'rgba(255,193,7,0.3)'}`,
                          }}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        {(() => {
                          const badge = orderPaymentBadge(o);
                          return (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '20px',
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                              }}
                            >
                              {badge.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', color: '#2ECC71', fontWeight: 500 }}>${(o.total / 100).toFixed(2)}</td>
                      <td style={{ padding: '1rem 1.5rem', color: '#8A8A8E', fontSize: '0.78rem' }}>
                        {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        {o.payment_status === 'authorized' && (
                          <button
                            onClick={() => runOrderAction(o.id, 'capture')}
                            disabled={orderActionLoadingId === o.id}
                            style={{
                              background: 'rgba(52,152,219,0.14)',
                              border: '1px solid rgba(52,152,219,0.35)',
                              borderRadius: '3px',
                              color: '#3498DB',
                              padding: '0.35rem 0.7rem',
                              fontSize: '0.72rem',
                              cursor: orderActionLoadingId === o.id ? 'not-allowed' : 'pointer',
                              opacity: orderActionLoadingId === o.id ? 0.7 : 1,
                            }}
                          >
                            {orderActionLoadingId === o.id ? 'Processing...' : 'Capture Hold'}
                          </button>
                        )}
                        {['captured', 'succeeded', 'paid'].includes(o.payment_status ?? '') && o.status !== 'fulfilled' && (
                          <button
                            onClick={() => runOrderAction(o.id, 'ship')}
                            disabled={orderActionLoadingId === o.id}
                            style={{
                              background: 'rgba(46,204,113,0.14)',
                              border: '1px solid rgba(46,204,113,0.35)',
                              borderRadius: '3px',
                              color: '#2ECC71',
                              padding: '0.35rem 0.7rem',
                              fontSize: '0.72rem',
                              cursor: orderActionLoadingId === o.id ? 'not-allowed' : 'pointer',
                              opacity: orderActionLoadingId === o.id ? 0.7 : 1,
                            }}
                          >
                            {orderActionLoadingId === o.id ? 'Processing...' : 'Mark Shipped'}
                          </button>
                        )}
                        {!(
                          o.payment_status === 'authorized' ||
                          (['captured', 'succeeded', 'paid'].includes(o.payment_status ?? '') && o.status !== 'fulfilled')
                        ) && <span style={{ color: '#8A8A8E', fontSize: '0.72rem' }}>N/A</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orderActionMessage && <p style={{ color: '#2ECC71', fontSize: '0.82rem', padding: '0.8rem 1.5rem 0.2rem' }}>{orderActionMessage}</p>}
              {orderActionError && <p style={{ color: '#E74C3C', fontSize: '0.82rem', padding: '0.8rem 1.5rem 0.2rem' }}>{orderActionError}</p>}
              {orders.length === 0 && <p style={{ color: '#8A8A8E', fontSize: '0.85rem', padding: '2rem 1.5rem' }}>No orders yet.</p>}
            </div>
          </div>
        )}

        {!loading && tab === 'ops' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ background: '#1A1A1C', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.82rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
                Reconciliation
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#0D0D0F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
                    Confirmed Orders Without Payment
                  </div>
                  <div style={{ fontSize: '1.6rem', fontFamily: "'DM Serif Display', serif", color: '#F39C12' }}>
                    {stats?.confirmedWithoutPayment ?? reconciliation?.confirmedWithoutPayment ?? 0}
                  </div>
                </div>
                <div style={{ background: '#0D0D0F', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
                    Orphan Payments
                  </div>
                  <div style={{ fontSize: '1.6rem', fontFamily: "'DM Serif Display', serif", color: '#9B59B6' }}>
                    {stats?.orphanPayments ?? reconciliation?.orphanPayments ?? 0}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: '#1A1A1C', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '0.82rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Recent Payments ({filteredPayments.length})
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <label style={{ fontSize: '0.72rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filter</label>
                  <select
                    value={paymentFilter}
                    onChange={e => setPaymentFilter(e.target.value as any)}
                    style={{
                      background: '#0D0D0F',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      color: '#F9F8F6',
                      fontSize: '0.8rem',
                      padding: '0.35rem 0.5rem',
                    }}
                  >
                    <option value="all">All</option>
                    <option value="authorized">Authorized</option>
                    <option value="failed">Failed</option>
                    <option value="other">Other</option>
                  </select>
                  <select
                    value={paymentDateRange}
                    onChange={e => setPaymentDateRange(e.target.value as DateRange)}
                    style={{
                      background: '#0D0D0F',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      color: '#F9F8F6',
                      fontSize: '0.8rem',
                      padding: '0.35rem 0.5rem',
                    }}
                  >
                    <option value="all">All time</option>
                    <option value="24h">24h</option>
                    <option value="7d">7d</option>
                    <option value="30d">30d</option>
                  </select>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['Payment Intent', 'Order', 'Amount', 'Status', 'Payout', 'Method', 'Date'].map(h => (
                        <th key={h} style={{ padding: '0.8rem 1.5rem', textAlign: 'left', fontSize: '0.68rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#1ABC9C' }}>
                          {p.stripe_payment_intent_id ?? 'N/A'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#8A8A8E' }}>
                          {p.order_id ?? 'N/A'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: '#2ECC71', fontWeight: 500 }}>
                          ${((p.amount ?? 0) / 100).toFixed(2)} {p.currency?.toUpperCase()}
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '20px',
                            background: p.status === 'authorized' ? 'rgba(46,204,113,0.1)' : 'rgba(255,193,7,0.1)',
                            color: p.status === 'authorized' ? '#2ECC71' : '#FFC107',
                            border: `1px solid ${p.status === 'authorized' ? 'rgba(46,204,113,0.3)' : 'rgba(255,193,7,0.3)'}`,
                          }}>
                            {p.status}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '20px',
                            background: p.payout_ready ? 'rgba(46,204,113,0.1)' : 'rgba(255,255,255,0.05)',
                            color: p.payout_ready ? '#2ECC71' : '#8A8A8E',
                            border: `1px solid ${p.payout_ready ? 'rgba(46,204,113,0.3)' : 'rgba(255,255,255,0.12)'}`,
                          }}>
                            {p.payout_ready ? 'Ready' : 'Not Ready'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: '#8A8A8E' }}>{p.payment_method ?? 'N/A'}</td>
                        <td style={{ padding: '1rem 1.5rem', color: '#8A8A8E', fontSize: '0.78rem' }}>
                          {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredPayments.length === 0 && <p style={{ color: '#8A8A8E', fontSize: '0.85rem', padding: '2rem 1.5rem' }}>No payments for selected filter.</p>}
              </div>
            </div>

            <div style={{ background: '#1A1A1C', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '0.82rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Recent Alerts ({filteredAlerts.length})
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <label style={{ fontSize: '0.72rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Severity</label>
                  <select
                    value={alertFilter}
                    onChange={e => setAlertFilter(e.target.value as any)}
                    style={{
                      background: '#0D0D0F',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      color: '#F9F8F6',
                      fontSize: '0.8rem',
                      padding: '0.35rem 0.5rem',
                    }}
                  >
                    <option value="all">All</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select
                    value={alertDateRange}
                    onChange={e => setAlertDateRange(e.target.value as DateRange)}
                    style={{
                      background: '#0D0D0F',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      color: '#F9F8F6',
                      fontSize: '0.8rem',
                      padding: '0.35rem 0.5rem',
                    }}
                  >
                    <option value="all">All time</option>
                    <option value="24h">24h</option>
                    <option value="7d">7d</option>
                    <option value="30d">30d</option>
                  </select>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['Alert Type', 'Severity', 'Status', 'Device', 'Created', 'Resolved'].map(h => (
                        <th key={h} style={{ padding: '0.8rem 1.5rem', textAlign: 'left', fontSize: '0.68rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.map((a, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '1rem 1.5rem' }}>{a.alert_type}</td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '20px',
                            background: a.severity === 'critical' ? 'rgba(231,76,60,0.1)' : a.severity === 'high' ? 'rgba(243,156,18,0.1)' : 'rgba(255,255,255,0.05)',
                            color: a.severity === 'critical' ? '#E74C3C' : a.severity === 'high' ? '#F39C12' : '#8A8A8E',
                            border: '1px solid rgba(255,255,255,0.12)',
                          }}>
                            {a.severity}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: '#8A8A8E' }}>{a.status}</td>
                        <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#8A8A8E' }}>
                          {a.device_id ?? 'N/A'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: '#8A8A8E', fontSize: '0.78rem' }}>
                          {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: '#8A8A8E', fontSize: '0.78rem' }}>
                          {a.resolved_at
                            ? new Date(a.resolved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredAlerts.length === 0 && <p style={{ color: '#8A8A8E', fontSize: '0.85rem', padding: '2rem 1.5rem' }}>No alerts for selected severity.</p>}
              </div>
            </div>

            <div style={{ background: '#1A1A1C', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 style={{ fontSize: '0.82rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Security Logs ({adminAuthLogs.length})
                </h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['Action', 'IP', 'Details', 'User Agent', 'Time'].map(h => (
                        <th key={h} style={{ padding: '0.8rem 1.5rem', textAlign: 'left', fontSize: '0.68rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adminAuthLogs.map((log, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '20px',
                            background:
                              log.action === 'login_success'
                                ? 'rgba(46,204,113,0.1)'
                                : log.action === 'login_failed' || log.action === 'login_blocked'
                                ? 'rgba(231,76,60,0.1)'
                                : 'rgba(255,255,255,0.05)',
                            color:
                              log.action === 'login_success'
                                ? '#2ECC71'
                                : log.action === 'login_failed' || log.action === 'login_blocked'
                                ? '#E74C3C'
                                : '#8A8A8E',
                            border: '1px solid rgba(255,255,255,0.12)',
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#8A8A8E' }}>
                          {log.ip_address ?? 'N/A'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: '#8A8A8E' }}>
                          {log.details ?? 'N/A'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: '#8A8A8E', maxWidth: '360px' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {log.user_agent ?? 'N/A'}
                          </div>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: '#8A8A8E', fontSize: '0.78rem' }}>
                          {new Date(log.created_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {adminAuthLogs.length === 0 && <p style={{ color: '#8A8A8E', fontSize: '0.85rem', padding: '2rem 1.5rem' }}>No security log entries yet.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
