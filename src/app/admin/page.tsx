'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';

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

interface Device {
  id: string;
  user_id: string;
  serial_number: string;
  model: string;
  status: string;
  battery_level: number | null;
  last_sync: string | null;
}

interface HealthReading {
  id: number;
  device_id: string;
  user_id: string;
  heart_rate: number | null;
  spo2: number | null;
  temperature: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  ai_risk_score: number | null;
  recorded_at: string;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface DeviceFilterState {
  search: string;
  status: string;
}

interface HealthFilterState {
  hours: string;
  minRisk: string;
  deviceId: string;
  userId: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'users' | 'orders' | 'ops' | 'devices' | 'health'>('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [adminAuthLogs, setAdminAuthLogs] = useState<AdminAuthLog[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [healthReadings, setHealthReadings] = useState<HealthReading[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [devicePagination, setDevicePagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [healthPagination, setHealthPagination] = useState<PaginationState>({
    page: 1,
    limit: 30,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [deviceFilters, setDeviceFilters] = useState<DeviceFilterState>({
    search: '',
    status: 'all',
  });
  const [healthFilters, setHealthFilters] = useState<HealthFilterState>({
    hours: '72',
    minRisk: '',
    deviceId: '',
    userId: '',
  });
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

  const userColumns = ['Name', 'Email', 'Role', 'Status', 'Joined'] as const;
  const adminOrderColumns = ['Order #', 'Customer', 'Device', 'Order Status', 'Payment Status', 'Total', 'Date', 'Action'] as const;

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
      setDevices([]);
      setHealthReadings([]);
      setDevicePagination({ page: 1, limit: 20, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false });
      setHealthPagination({ page: 1, limit: 30, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false });
      setDeviceFilters({ search: '', status: 'all' });
      setHealthFilters({ hours: '72', minRisk: '', deviceId: '', userId: '' });
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
        showToast({ type: 'error', title: 'Admin Sign-in Failed', message: json?.error || 'Failed to sign in.' });
        return;
      }
      setAuthed(true);
      showToast({ type: 'success', title: 'Admin Signed In' });
      await loadData();
    } catch {
      setError('Network error while signing in.');
      showToast({ type: 'error', title: 'Admin Sign-in Failed', message: 'Network error while signing in.' });
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
        showToast({ type: 'error', title: 'Admin Data Error', message: json?.error || 'Failed to load admin data.' });
      }
    } catch (err) {
      console.error(err);
      setLoadError('Network error while loading admin data.');
      showToast({ type: 'error', title: 'Admin Data Error', message: 'Network error while loading admin data.' });
    } finally {
      setLoading(false);
    }

    // Load paginated admin modules in parallel.
    await Promise.all([loadDevices(1), loadHealthReadings(1)]);
  };

  const loadDevices = async (page = 1, overrides?: DeviceFilterState) => {
    setDevicesLoading(true);
    try {
      const filters = overrides ?? deviceFilters;
      const params = new URLSearchParams({
        page: String(page),
        limit: String(devicePagination.limit),
      });
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.status && filters.status !== 'all') params.set('status', filters.status);

      const res = await fetch(`/api/admin/devices?${params.toString()}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok) {
        setDevices(json.devices || []);
        if (json.pagination) {
          setDevicePagination(json.pagination);
        }
      } else if (res.status === 401) {
        setAuthed(false);
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setDevicesLoading(false);
    }
  };

  const loadHealthReadings = async (page = 1, overrides?: HealthFilterState) => {
    setHealthLoading(true);
    try {
      const filters = overrides ?? healthFilters;
      const params = new URLSearchParams({
        page: String(page),
        limit: String(healthPagination.limit),
        hours: String(Math.max(1, Number(filters.hours || 72))),
      });
      if (filters.minRisk.trim()) params.set('minRisk', filters.minRisk.trim());
      if (filters.deviceId.trim()) params.set('deviceId', filters.deviceId.trim());
      if (filters.userId.trim()) params.set('userId', filters.userId.trim());

      const res = await fetch(`/api/admin/health-readings?${params.toString()}`, {
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok) {
        setHealthReadings(json.readings || []);
        if (json.pagination) {
          setHealthPagination(json.pagination);
        }
      } else if (res.status === 401) {
        setAuthed(false);
      }
    } catch (err) {
      console.error('Failed to load health readings:', err);
    } finally {
      setHealthLoading(false);
    }
  };

  // Auto-apply devices filters with debounce while typing/changing status.
  useEffect(() => {
    if (!authed || tab !== 'devices') return;
    const timer = setTimeout(() => {
      void loadDevices(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [authed, tab, deviceFilters.search, deviceFilters.status]);

  // Auto-apply health filters with debounce when inputs are valid.
  useEffect(() => {
    if (!authed || tab !== 'health') return;

    const hours = Number(healthFilters.hours);
    const minRisk = healthFilters.minRisk.trim();
    const deviceId = healthFilters.deviceId.trim();
    const userId = healthFilters.userId.trim();

    const uuidRegex = /^[0-9a-fA-F-]{36}$/;
    const validHours = Number.isFinite(hours) && hours > 0;
    const validMinRisk =
      !minRisk || (!Number.isNaN(Number(minRisk)) && Number(minRisk) >= 0 && Number(minRisk) <= 1);
    const validDeviceId = !deviceId || uuidRegex.test(deviceId);
    const validUserId = !userId || uuidRegex.test(userId);

    if (!validHours || !validMinRisk || !validDeviceId || !validUserId) return;

    const timer = setTimeout(() => {
      void loadHealthReadings(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [authed, tab, healthFilters.hours, healthFilters.minRisk, healthFilters.deviceId, healthFilters.userId]);

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
    return { label: 'Pending', bg: 'rgba(255,255,255,0.05)', color: 'var(--muted)', border: 'rgba(255,255,255,0.12)' };
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
        showToast({ type: 'error', title: 'Order Action Failed', message: json?.error || 'Failed to process action.' });
        return;
      }
      setOrderActionMessage(json?.message || 'Order updated.');
      showToast({ type: 'success', title: action === 'capture' ? 'Payment Captured' : 'Order Marked Shipped' });
      await loadData();
    } catch {
      setOrderActionError('Network error while updating order.');
      showToast({ type: 'error', title: 'Order Action Failed', message: 'Network error while updating order.' });
    } finally {
      setOrderActionLoadingId(null);
    }
  };

  if (!authed) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--deep)',
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
              color: 'var(--white)',
              marginBottom: '2.5rem',
            }}
          >
            VITAR<span style={{ color: '#C0392B' }}>.</span>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--muted)',
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
              background: 'var(--graphite)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '2.5rem',
            }}
          >
            <h1
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: '1.6rem',
                color: 'var(--white)',
                marginBottom: '0.4rem',
              }}
            >
              Admin Access
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '2rem' }}>
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
                    color: 'var(--muted)',
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
                    background: 'var(--deep)',
                    border: '1px solid var(--border)',
                    borderRadius: '3px',
                    padding: '0.85rem 1rem',
                    color: 'var(--white)',
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
                  color: 'var(--white)',
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
    <div style={{ minHeight: '100vh', background: 'var(--deep)', fontFamily: "'DM Sans', sans-serif", color: 'var(--white)' }}>
      <nav
        style={{
          padding: '0 2rem',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--graphite)',
          borderBottom: '1px solid var(--border)',
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
              color: 'var(--muted)',
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
              color: 'var(--white)',
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
              color: 'var(--muted)',
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
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0',
            overflowX: 'auto',
          }}
        >
          {(['overview', 'users', 'orders', 'devices', 'health', 'ops'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid #C0392B' : '2px solid transparent',
                color: tab === t ? 'var(--white)' : 'var(--muted)',
                padding: '0.8rem 1.5rem',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '0.85rem',
                cursor: 'pointer',
                textTransform: 'capitalize',
                fontWeight: tab === t ? 500 : 400,
                letterSpacing: '0.05em',
                marginBottom: '-1px',
                whiteSpace: 'nowrap',
              }}
            >
              {t === 'devices' ? '📱 Devices' : t === 'health' ? '❤️ Health Data' : t}
            </button>
          ))}
        </div>

        {loading && (
          <div className="skeleton-stack" style={{ padding: '1.2rem 0 0.4rem' }}>
            <div className="skeleton-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="skeleton-card">
                  <div className="skeleton-line short" />
                  <div className="skeleton-line mid" style={{ marginTop: '0.9rem', height: '28px' }} />
                </div>
              ))}
            </div>
            <div className="skeleton-panel">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="skeleton-row">
                  <div className="skeleton-line long" />
                  <div className="skeleton-line mid" />
                  <div className="skeleton-line short" />
                  <div className="skeleton-line short" />
                  <div className="skeleton-line mid" />
                </div>
              ))}
            </div>
          </div>
        )}
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
                { label: 'Total Users', value: stats?.totalUsers ?? users.length, color: 'var(--white)' },
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
                    background: 'var(--graphite)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '1.5rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--muted)',
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
                background: 'var(--graphite)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1.5rem',
                marginBottom: '1rem',
              }}
            >
              <h3
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--muted)',
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
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{u.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '20px',
                        background: u.is_verified ? 'rgba(46,204,113,0.1)' : 'rgba(255,255,255,0.05)',
                        color: u.is_verified ? '#2ECC71' : 'var(--muted)',
                        border: `1px solid ${u.is_verified ? 'rgba(46,204,113,0.3)' : 'var(--border)'}`,
                      }}
                    >
                      {u.is_verified ? 'Verified' : 'Unverified'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {users.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No users yet.</p>}
            </div>
          </div>
        )}

        {!loading && tab === 'users' && (
          <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <div
              style={{
                padding: '1.2rem 1.5rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: '0.82rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                All Users ({users.length})
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table table-card" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {userColumns.map(h => (
                      <th
                        key={h}
                        style={{
                          padding: '0.8rem 1.5rem',
                          textAlign: 'left',
                          fontSize: '0.68rem',
                          color: 'var(--muted)',
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
                      <td data-label={userColumns[0]} style={{ padding: '1rem 1.5rem', fontWeight: 500 }}>
                        {u.first_name} {u.last_name}
                      </td>
                      <td data-label={userColumns[1]} style={{ padding: '1rem 1.5rem', color: 'var(--muted)' }}>{u.email}</td>
                      <td data-label={userColumns[2]} style={{ padding: '1rem 1.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '20px',
                            background: u.role === 'admin' ? 'rgba(192,57,43,0.1)' : 'rgba(255,255,255,0.05)',
                            color: u.role === 'admin' ? '#C0392B' : 'var(--muted)',
                            border: `1px solid ${u.role === 'admin' ? 'rgba(192,57,43,0.3)' : 'var(--border)'}`,
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td data-label={userColumns[3]} style={{ padding: '1rem 1.5rem' }}>
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
                      <td data-label={userColumns[4]} style={{ padding: '1rem 1.5rem', color: 'var(--muted)', fontSize: '0.78rem' }}>
                        {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '2rem 1.5rem' }}>No users yet.</p>}
            </div>
          </div>
        )}

        {!loading && tab === 'orders' && (
          <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.82rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                All Orders ({orders.length})
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table table-card" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {adminOrderColumns.map(h => (
                      <th
                        key={h}
                        style={{
                          padding: '0.8rem 1.5rem',
                          textAlign: 'left',
                          fontSize: '0.68rem',
                          color: 'var(--muted)',
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
                      <td data-label={adminOrderColumns[0]} style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontSize: '0.78rem', color: '#C0392B' }}>
                        {o.order_number}
                      </td>
                      <td data-label={adminOrderColumns[1]} style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ fontWeight: 500 }}>
                          {o.first_name} {o.last_name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{o.email}</div>
                      </td>
                      <td data-label={adminOrderColumns[2]} style={{ padding: '1rem 1.5rem', color: 'var(--muted)' }}>VITAR {o.device_model}</td>
                      <td data-label={adminOrderColumns[3]} style={{ padding: '1rem 1.5rem' }}>
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
                      <td data-label={adminOrderColumns[4]} style={{ padding: '1rem 1.5rem' }}>
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
                      <td data-label={adminOrderColumns[5]} style={{ padding: '1rem 1.5rem', color: '#2ECC71', fontWeight: 500 }}>${(o.total / 100).toFixed(2)}</td>
                      <td data-label={adminOrderColumns[6]} style={{ padding: '1rem 1.5rem', color: 'var(--muted)', fontSize: '0.78rem' }}>
                        {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td data-label={adminOrderColumns[7]} style={{ padding: '1rem 1.5rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
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
                        ) && <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>N/A</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orderActionMessage && <p style={{ color: '#2ECC71', fontSize: '0.82rem', padding: '0.8rem 1.5rem 0.2rem' }}>{orderActionMessage}</p>}
              {orderActionError && <p style={{ color: '#E74C3C', fontSize: '0.82rem', padding: '0.8rem 1.5rem 0.2rem' }}>{orderActionError}</p>}
              {orders.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '2rem 1.5rem' }}>No orders yet.</p>}
            </div>
          </div>
        )}

        {!loading && tab === 'ops' && (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '0.82rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
                Reconciliation
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ background: 'var(--deep)', border: '1px solid var(--border)', borderRadius: '6px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
                    Confirmed Orders Without Payment
                  </div>
                  <div style={{ fontSize: '1.6rem', fontFamily: "'DM Serif Display', serif", color: '#F39C12' }}>
                    {stats?.confirmedWithoutPayment ?? reconciliation?.confirmedWithoutPayment ?? 0}
                  </div>
                </div>
                <div style={{ background: 'var(--deep)', border: '1px solid var(--border)', borderRadius: '6px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
                    Orphan Payments
                  </div>
                  <div style={{ fontSize: '1.6rem', fontFamily: "'DM Serif Display', serif", color: '#9B59B6' }}>
                    {stats?.orphanPayments ?? reconciliation?.orphanPayments ?? 0}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '0.82rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Recent Payments ({filteredPayments.length})
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Filter</label>
                  <select
                    value={paymentFilter}
                    onChange={e => setPaymentFilter(e.target.value as any)}
                    style={{
                      background: 'var(--deep)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      color: 'var(--white)',
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
                      background: 'var(--deep)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      color: 'var(--white)',
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
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Payment Intent', 'Order', 'Amount', 'Status', 'Payout', 'Method', 'Date'].map(h => (
                        <th key={h} style={{ padding: '0.8rem 1.5rem', textAlign: 'left', fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
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
                        <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--muted)' }}>
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
                            color: p.payout_ready ? '#2ECC71' : 'var(--muted)',
                            border: `1px solid ${p.payout_ready ? 'rgba(46,204,113,0.3)' : 'rgba(255,255,255,0.12)'}`,
                          }}>
                            {p.payout_ready ? 'Ready' : 'Not Ready'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: 'var(--muted)' }}>{p.payment_method ?? 'N/A'}</td>
                        <td style={{ padding: '1rem 1.5rem', color: 'var(--muted)', fontSize: '0.78rem' }}>
                          {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredPayments.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '2rem 1.5rem' }}>No payments for selected filter.</p>}
              </div>
            </div>

            <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '0.82rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Recent Alerts ({filteredAlerts.length})
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Severity</label>
                  <select
                    value={alertFilter}
                    onChange={e => setAlertFilter(e.target.value as any)}
                    style={{
                      background: 'var(--deep)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      color: 'var(--white)',
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
                      background: 'var(--deep)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      color: 'var(--white)',
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
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Alert Type', 'Severity', 'Status', 'Device', 'Created', 'Resolved'].map(h => (
                        <th key={h} style={{ padding: '0.8rem 1.5rem', textAlign: 'left', fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
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
                            color: a.severity === 'critical' ? '#E74C3C' : a.severity === 'high' ? '#F39C12' : 'var(--muted)',
                            border: '1px solid rgba(255,255,255,0.12)',
                          }}>
                            {a.severity}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: 'var(--muted)' }}>{a.status}</td>
                        <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--muted)' }}>
                          {a.device_id ?? 'N/A'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: 'var(--muted)', fontSize: '0.78rem' }}>
                          {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: 'var(--muted)', fontSize: '0.78rem' }}>
                          {a.resolved_at
                            ? new Date(a.resolved_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredAlerts.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '2rem 1.5rem' }}>No alerts for selected severity.</p>}
              </div>
            </div>

            <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '0.82rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Security Logs ({adminAuthLogs.length})
                </h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Action', 'IP', 'Details', 'User Agent', 'Time'].map(h => (
                        <th key={h} style={{ padding: '0.8rem 1.5rem', textAlign: 'left', fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
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
                                : 'var(--muted)',
                            border: '1px solid rgba(255,255,255,0.12)',
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--muted)' }}>
                          {log.ip_address ?? 'N/A'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: 'var(--muted)' }}>
                          {log.details ?? 'N/A'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: 'var(--muted)', maxWidth: '360px' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {log.user_agent ?? 'N/A'}
                          </div>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: 'var(--muted)', fontSize: '0.78rem' }}>
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
                {adminAuthLogs.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '2rem 1.5rem' }}>No security log entries yet.</p>}
              </div>
            </div>
          </div>
        )}

        {!loading && tab === 'devices' && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem',
              }}
            >
              <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.8rem' }}>
                  Total Devices
                </div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.5rem', color: '#C0392B', lineHeight: 1 }}>
                  {devicePagination.total}
                </div>
              </div>
              <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.8rem' }}>
                  Active Devices
                </div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.5rem', color: '#2ECC71', lineHeight: 1 }}>
                  {devices.filter(d => d.status === 'online').length}
                </div>
              </div>
              <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1.5rem' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.8rem' }}>
                  Health Readings
                </div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2.5rem', color: '#F39C12', lineHeight: 1 }}>
                  {healthPagination.total}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '0.82rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Registered Wearables ({devicePagination.total})
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void loadDevices(1);
                  }}
                  style={{ marginTop: '0.9rem', display: 'grid', gridTemplateColumns: '1.4fr 0.8fr auto auto', gap: '0.6rem' }}
                >
                  <input
                    value={deviceFilters.search}
                    onChange={(e) => setDeviceFilters((prev) => ({ ...prev, search: e.target.value }))}
                    placeholder="Search serial/model/user/status"
                    style={{
                      background: 'var(--deep)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--white)',
                      fontSize: '0.8rem',
                      padding: '0.5rem 0.7rem',
                    }}
                  />
                  <select
                    value={deviceFilters.status}
                    onChange={(e) => setDeviceFilters((prev) => ({ ...prev, status: e.target.value }))}
                    style={{
                      background: 'var(--deep)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--white)',
                      fontSize: '0.8rem',
                      padding: '0.5rem 0.7rem',
                    }}
                  >
                    <option value="all">All Status</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="connected">Connected</option>
                    <option value="charging">Charging</option>
                  </select>
                  <button
                    type="submit"
                    disabled={devicesLoading}
                    style={{
                      background: '#C0392B',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'var(--white)',
                      fontSize: '0.75rem',
                      padding: '0.45rem 0.7rem',
                      cursor: devicesLoading ? 'not-allowed' : 'pointer',
                      opacity: devicesLoading ? 0.7 : 1,
                    }}
                  >
                    {devicesLoading ? 'Applying...' : 'Apply'}
                  </button>
                  <button
                    type="button"
                    disabled={devicesLoading}
                    onClick={() => {
                      const defaults: DeviceFilterState = { search: '', status: 'all' };
                      setDeviceFilters(defaults);
                      void loadDevices(1, defaults);
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--muted)',
                      fontSize: '0.75rem',
                      padding: '0.45rem 0.7rem',
                      cursor: devicesLoading ? 'not-allowed' : 'pointer',
                      opacity: devicesLoading ? 0.7 : 1,
                    }}
                  >
                    Reset
                  </button>
                </form>
              </div>
              {devicesLoading && (
                <div style={{ padding: '0.55rem 1.5rem', color: 'var(--muted)', fontSize: '0.76rem', borderBottom: '1px solid var(--border)' }}>
                  Loading devices...
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Serial #', 'Model', 'Status', 'Battery', 'Last Sync'].map((col, i) => (
                        <th key={i} style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((device, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '1rem 1.5rem', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                          {device.serial_number}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                          {device.model}
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '0.3rem 0.8rem',
                              borderRadius: '20px',
                              background: device.status === 'online' ? 'rgba(46,204,113,0.1)' : 'rgba(255,255,255,0.05)',
                              color: device.status === 'online' ? '#2ECC71' : 'var(--muted)',
                              border: `1px solid ${device.status === 'online' ? 'rgba(46,204,113,0.3)' : 'var(--border)'}`,
                              textTransform: 'capitalize',
                            }}
                          >
                            {device.status}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: device.battery_level !== null && device.battery_level < 20 ? '#E74C3C' : 'var(--white)' }}>
                          {device.battery_level !== null ? `${device.battery_level}%` : 'N/A'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                          {device.last_sync ? new Date(device.last_sync).toLocaleString().split(',')[0] : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {devices.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '2rem 1.5rem' }}>No devices registered yet.</p>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>
                  Page {devicePagination.page} / {devicePagination.totalPages}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => loadDevices(devicePagination.page - 1)}
                    disabled={!devicePagination.hasPrevPage || devicesLoading}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      color: 'var(--white)',
                      fontSize: '0.74rem',
                      padding: '0.4rem 0.65rem',
                      cursor: devicePagination.hasPrevPage && !devicesLoading ? 'pointer' : 'not-allowed',
                      opacity: devicePagination.hasPrevPage && !devicesLoading ? 1 : 0.65,
                    }}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => loadDevices(devicePagination.page + 1)}
                    disabled={!devicePagination.hasNextPage || devicesLoading}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      color: 'var(--white)',
                      fontSize: '0.74rem',
                      padding: '0.4rem 0.65rem',
                      cursor: devicePagination.hasNextPage && !devicesLoading ? 'pointer' : 'not-allowed',
                      opacity: devicePagination.hasNextPage && !devicesLoading ? 1 : 0.65,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && tab === 'health' && (
          <div>
            <div style={{ background: 'var(--graphite)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '0.82rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Recent Health Readings ({healthPagination.total})
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void loadHealthReadings(1);
                  }}
                  style={{ marginTop: '0.9rem', display: 'grid', gridTemplateColumns: '0.5fr 0.6fr 1fr 1fr auto auto', gap: '0.6rem' }}
                >
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={healthFilters.hours}
                    onChange={(e) => setHealthFilters((prev) => ({ ...prev, hours: e.target.value }))}
                    placeholder="Hours"
                    style={{
                      background: 'var(--deep)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--white)',
                      fontSize: '0.8rem',
                      padding: '0.5rem 0.7rem',
                    }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step="0.01"
                    value={healthFilters.minRisk}
                    onChange={(e) => setHealthFilters((prev) => ({ ...prev, minRisk: e.target.value }))}
                    placeholder="Min risk 0-1"
                    style={{
                      background: 'var(--deep)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--white)',
                      fontSize: '0.8rem',
                      padding: '0.5rem 0.7rem',
                    }}
                  />
                  <input
                    value={healthFilters.deviceId}
                    onChange={(e) => setHealthFilters((prev) => ({ ...prev, deviceId: e.target.value }))}
                    placeholder="Filter by device UUID"
                    style={{
                      background: 'var(--deep)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--white)',
                      fontSize: '0.8rem',
                      padding: '0.5rem 0.7rem',
                    }}
                  />
                  <input
                    value={healthFilters.userId}
                    onChange={(e) => setHealthFilters((prev) => ({ ...prev, userId: e.target.value }))}
                    placeholder="Filter by user UUID"
                    style={{
                      background: 'var(--deep)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--white)',
                      fontSize: '0.8rem',
                      padding: '0.5rem 0.7rem',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={healthLoading}
                    style={{
                      background: '#C0392B',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'var(--white)',
                      fontSize: '0.75rem',
                      padding: '0.45rem 0.7rem',
                      cursor: healthLoading ? 'not-allowed' : 'pointer',
                      opacity: healthLoading ? 0.7 : 1,
                    }}
                  >
                    {healthLoading ? 'Applying...' : 'Apply'}
                  </button>
                  <button
                    type="button"
                    disabled={healthLoading}
                    onClick={() => {
                      const defaults: HealthFilterState = { hours: '72', minRisk: '', deviceId: '', userId: '' };
                      setHealthFilters(defaults);
                      void loadHealthReadings(1, defaults);
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--muted)',
                      fontSize: '0.75rem',
                      padding: '0.45rem 0.7rem',
                      cursor: healthLoading ? 'not-allowed' : 'pointer',
                      opacity: healthLoading ? 0.7 : 1,
                    }}
                  >
                    Reset
                  </button>
                </form>
              </div>
              {healthLoading && (
                <div style={{ padding: '0.55rem 1.5rem', color: 'var(--muted)', fontSize: '0.76rem', borderBottom: '1px solid var(--border)' }}>
                  Loading health readings...
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Timestamp', 'Heart Rate', 'SpO2', 'Temp', 'SystolicBP', 'AI Risk', 'Status'].map((col, i) => (
                        <th key={i} style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {healthReadings.map((reading, i) => {
                      const isRiskHigh = (reading.ai_risk_score ?? 0) > 0.75;
                      const isOxygenLow = (reading.spo2 ?? 0) < 90;
                      const isHRAbNormal = (reading.heart_rate ?? 0) > 120 || (reading.heart_rate ?? 0) < 40;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                            {new Date(reading.recorded_at).toLocaleString().split(',')[0]}
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: isHRAbNormal ? '#E74C3C' : 'var(--white)' }}>
                            {reading.heart_rate ?? 'N/A'} <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>bpm</span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: isOxygenLow ? '#E74C3C' : 'var(--white)' }}>
                            {reading.spo2 ?? 'N/A'}<span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>%</span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                            {reading.temperature ?? 'N/A'} <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>C</span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem' }}>
                            {reading.systolic_bp ?? 'N/A'} <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>mmHg</span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: isRiskHigh ? '#E74C3C' : 'var(--white)' }}>
                            {reading.ai_risk_score !== null ? (reading.ai_risk_score * 100).toFixed(1) : 'N/A'} <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>%</span>
                          </td>
                          <td style={{ padding: '1rem 1.5rem' }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '0.3rem 0.8rem',
                                borderRadius: '20px',
                                background: isRiskHigh || isOxygenLow ? 'rgba(231,76,60,0.1)' : 'rgba(46,204,113,0.1)',
                                color: isRiskHigh || isOxygenLow ? '#E74C3C' : '#2ECC71',
                                border: `1px solid ${isRiskHigh || isOxygenLow ? 'rgba(231,76,60,0.3)' : 'rgba(46,204,113,0.3)'}`,
                              }}
                            >
                              {isRiskHigh || isOxygenLow ? 'Alert' : 'Normal'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {healthReadings.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '2rem 1.5rem' }}>No health readings yet.</p>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>
                  Page {healthPagination.page} / {healthPagination.totalPages}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => loadHealthReadings(healthPagination.page - 1)}
                    disabled={!healthPagination.hasPrevPage || healthLoading}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      color: 'var(--white)',
                      fontSize: '0.74rem',
                      padding: '0.4rem 0.65rem',
                      cursor: healthPagination.hasPrevPage && !healthLoading ? 'pointer' : 'not-allowed',
                      opacity: healthPagination.hasPrevPage && !healthLoading ? 1 : 0.65,
                    }}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => loadHealthReadings(healthPagination.page + 1)}
                    disabled={!healthPagination.hasNextPage || healthLoading}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                      color: 'var(--white)',
                      fontSize: '0.74rem',
                      padding: '0.4rem 0.65rem',
                      cursor: healthPagination.hasNextPage && !healthLoading ? 'pointer' : 'not-allowed',
                      opacity: healthPagination.hasNextPage && !healthLoading ? 1 : 0.65,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
