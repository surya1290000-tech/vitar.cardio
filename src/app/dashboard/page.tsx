'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/ToastProvider';

interface Order {
  id: string;
  order_number: string;
  device_model: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  stripe_session_id?: string | null;
}

interface Device {
  id: string;
  serialNumber?: string | null;
  model: string | null;
  firmwareVersion?: string | null;
  status: string | null;
  batteryLevel: number | null;
  lastSync: string | null;
}

interface HealthReading {
  id: number;
  deviceId: string;
  recordedAt: string;
  heartRate: number | null;
  spo2: number | null;
  aiRiskScore: number | null;
}

interface AlertItem {
  id: string;
  deviceId: string | null;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt: string | null;
}

export default function DashboardPage() {
  const { user, isAuthenticated, accessToken, setUser } = useAuthStore();
  const { logout } = useLogout();
  const { showToast } = useToast();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [latestReading, setLatestReading] = useState<HealthReading | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [pairSerialNumber, setPairSerialNumber] = useState('');
  const [pairModel, setPairModel] = useState('core');

  const [ordersLoading, setOrdersLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [deviceActionLoadingId, setDeviceActionLoadingId] = useState<string | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertActionLoadingId, setAlertActionLoadingId] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState('');
  const [healthError, setHealthError] = useState('');
  const [alertsError, setAlertsError] = useState('');
  const [pairSuccess, setPairSuccess] = useState('');
  const [pairError, setPairError] = useState('');
  const [alertsInfo, setAlertsInfo] = useState('');
  const [demoMode, setDemoMode] = useState(true);

  const [demoDevice, setDemoDevice] = useState<Device>({
    id: 'demo-device',
    serialNumber: 'VTR-DEMO-001',
    model: 'pro',
    firmwareVersion: '0.9.0-demo',
    status: 'connected',
    batteryLevel: 87,
    lastSync: new Date().toISOString(),
  });

  const [demoReading, setDemoReading] = useState<HealthReading>({
    id: 1,
    deviceId: 'demo-device',
    recordedAt: new Date().toISOString(),
    heartRate: 74,
    spo2: 98,
    aiRiskScore: 0.12,
  });

  const deviceColumns = ['Serial', 'Model', 'Status', 'Battery', 'Last Sync', 'Action'] as const;
  const alertColumns = ['Type', 'Severity', 'Status', 'Created', 'Action'] as const;
  const orderColumns = ['Order #', 'Device', 'Status', 'Total', 'Date'] as const;

  const effectiveDevices = useMemo(() => (demoMode && devices.length === 0 ? [demoDevice] : devices), [demoMode, devices, demoDevice]);
  const effectiveReading = useMemo(() => (demoMode && !latestReading ? demoReading : latestReading), [demoMode, latestReading, demoReading]);
  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);
  const primaryDevice = useMemo(() => effectiveDevices[0] ?? null, [effectiveDevices]);
  const hasDevice = Boolean(primaryDevice);
  const deviceStatus = primaryDevice?.status ? primaryDevice.status.replace(/_/g, ' ') : 'not connected';
  const heartRateValue = effectiveReading?.heartRate ?? null;
  const spo2Value = effectiveReading?.spo2 ?? null;
  const riskScorePercent = effectiveReading?.aiRiskScore != null ? Math.round(effectiveReading.aiRiskScore * 100) : null;
  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === 'pending' || a.status === 'acknowledged'), [alerts]);

  useEffect(() => {
    const stored = window.localStorage.getItem('vitar-demo-mode');
    if (stored === '1') setDemoMode(true);
    if (stored === '0') setDemoMode(false);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('vitar-demo-mode', demoMode ? '1' : '0');
  }, [demoMode]);

  useEffect(() => {
    if (!demoMode || devices.length > 0) return;

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const interval = setInterval(() => {
      setDemoReading((prev) => {
        const heartRateBase = prev.heartRate ?? 74;
        const spo2Base = prev.spo2 ?? 98;
        const riskBase = prev.aiRiskScore ?? 0.12;

        const nextHeartRate = clamp(heartRateBase + (Math.random() < 0.5 ? -2 : 2), 62, 95);
        const nextSpo2 = clamp(spo2Base + (Math.random() < 0.5 ? -0.3 : 0.3), 96, 100);
        const nextRisk = clamp(riskBase + (Math.random() < 0.5 ? -0.01 : 0.01), 0.05, 0.25);

        return {
          ...prev,
          recordedAt: new Date().toISOString(),
          heartRate: nextHeartRate,
          spo2: Number(nextSpo2.toFixed(1)),
          aiRiskScore: Number(nextRisk.toFixed(2)),
        };
      });

      setDemoDevice((prev) => {
        const currentBattery = prev.batteryLevel ?? 87;
        const batteryDrop = Math.random() < 0.2 ? 1 : 0;
        return {
          ...prev,
          batteryLevel: clamp(currentBattery - batteryDrop, 40, 100),
          lastSync: new Date().toISOString(),
        };
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [demoMode, devices.length]);

  const getAccessToken = useCallback(async () => {
    if (accessToken) return accessToken;
    if (!user) return null;

    const refreshRes = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    const refreshJson = await refreshRes.json();
    if (!refreshRes.ok || !refreshJson?.accessToken) return null;

    setUser(user, refreshJson.accessToken);
    return refreshJson.accessToken as string;
  }, [accessToken, user, setUser]);

  const fetchOrders = useCallback(async (token: string, active = true) => {
    const ordersRes = await fetch('/api/orders', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const ordersJson = await ordersRes.json();

    if (!ordersRes.ok) {
      if (active) setOrdersError(ordersJson?.error || 'Failed to load orders.');
      return;
    }

    if (active) setOrders(Array.isArray(ordersJson.orders) ? ordersJson.orders : []);
  }, []);

  const fetchHealthData = useCallback(async (token: string, active = true) => {
    const [devicesRes, readingsRes] = await Promise.all([
      fetch('/api/devices', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/health/readings?limit=1', { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    const [devicesJson, readingsJson] = await Promise.all([devicesRes.json(), readingsRes.json()]);

    if (devicesRes.ok) {
      if (active) setDevices(Array.isArray(devicesJson.devices) ? devicesJson.devices : []);
    } else if (active) {
      setHealthError(devicesJson?.error || 'Failed to load devices.');
    }

    if (readingsRes.ok) {
      if (active) {
        const first = Array.isArray(readingsJson.readings) ? readingsJson.readings[0] : null;
        setLatestReading(first ?? null);
      }
    } else if (active) {
      setHealthError(readingsJson?.error || 'Failed to load health readings.');
    }
  }, []);

  const fetchAlerts = useCallback(async (token: string, active = true) => {
    const res = await fetch('/api/alerts?limit=10', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!res.ok) {
      if (active) setAlertsError(json?.error || 'Failed to load alerts.');
      return;
    }
    if (active) setAlerts(Array.isArray(json.alerts) ? json.alerts : []);
  }, []);

  const triggerTestAlert = async () => {
    setAlertsInfo('');
    setAlertsError('');
    setAlertsLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setAlertsError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const body = {
        deviceId: hasDevice && primaryDevice?.id !== 'demo-device' ? primaryDevice?.id : undefined,
        alertType: 'cardiac_anomaly',
        severity: 'critical',
        healthSnapshot: {
          heartRate: heartRateValue,
          spo2: spo2Value,
          aiRiskScore: effectiveReading?.aiRiskScore ?? null,
          source: demoMode ? 'demo' : 'device',
        },
      };

      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setAlertsError(json?.error || 'Failed to trigger alert.');
        showToast({ type: 'error', title: 'Alert Failed', message: json?.error || 'Failed to trigger alert.' });
        return;
      }

      setAlertsInfo('Test alert triggered.');
      showToast({ type: 'success', title: 'Alert Triggered' });
      await fetchAlerts(token);
    } catch {
      setAlertsError('Network error while triggering alert.');
      showToast({ type: 'error', title: 'Alert Failed', message: 'Network error while triggering alert.' });
    } finally {
      setAlertsLoading(false);
    }
  };

  const updateAlertStatus = async (id: string, status: 'acknowledged' | 'resolved') => {
    setAlertActionLoadingId(id);
    setAlertsInfo('');
    setAlertsError('');
    try {
      const token = await getAccessToken();
      if (!token) {
        setAlertsError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAlertsError(json?.error || 'Failed to update alert.');
        showToast({ type: 'error', title: 'Alert Update Failed', message: json?.error || 'Failed to update alert.' });
        return;
      }

      setAlertsInfo(status === 'acknowledged' ? 'Alert acknowledged.' : 'Alert resolved.');
      showToast({ type: 'success', title: status === 'acknowledged' ? 'Alert Acknowledged' : 'Alert Resolved' });
      await fetchAlerts(token);
    } catch {
      setAlertsError('Network error while updating alert.');
      showToast({ type: 'error', title: 'Alert Update Failed', message: 'Network error while updating alert.' });
    } finally {
      setAlertActionLoadingId(null);
    }
  };

  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairSuccess('');
    setPairError('');
    setHealthError('');

    const serial = pairSerialNumber.trim();
    if (!serial) {
      setPairError('Enter a serial number.');
      showToast({ type: 'error', title: 'Device Pairing', message: 'Enter a serial number.' });
      return;
    }

    setPairing(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setPairError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serialNumber: serial, model: pairModel }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPairError(json?.error || 'Failed to pair device.');
        showToast({ type: 'error', title: 'Pairing Failed', message: json?.error || 'Failed to pair device.' });
        return;
      }

      setPairSerialNumber('');
      setPairSuccess('Device paired successfully.');
      showToast({ type: 'success', title: 'Device Paired' });
      await fetchHealthData(token);
    } catch {
      setPairError('Network error while pairing device.');
      showToast({ type: 'error', title: 'Pairing Failed', message: 'Network error while pairing device.' });
    } finally {
      setPairing(false);
    }
  };

  const handleUnpairDevice = async (id: string) => {
    setDeviceActionLoadingId(id);
    setPairSuccess('');
    setPairError('');
    setHealthError('');

    try {
      const token = await getAccessToken();
      if (!token) {
        setPairError('Session expired. Please sign in again.');
        showToast({ type: 'error', title: 'Session Expired', message: 'Please sign in again.' });
        return;
      }

      const res = await fetch('/api/devices', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPairError(json?.error || 'Failed to unpair device.');
        showToast({ type: 'error', title: 'Unpair Failed', message: json?.error || 'Failed to unpair device.' });
        return;
      }

      setPairSuccess('Device unpaired.');
      showToast({ type: 'success', title: 'Device Unpaired' });
      await fetchHealthData(token);
    } catch {
      setPairError('Network error while unpairing device.');
      showToast({ type: 'error', title: 'Unpair Failed', message: 'Network error while unpairing device.' });
    } finally {
      setDeviceActionLoadingId(null);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    let active = true;

    const loadDashboardData = async () => {
      if (!isAuthenticated || !user) return;

      setOrdersLoading(true);
      setHealthLoading(true);
      setAlertsLoading(true);
      setOrdersError('');
      setHealthError('');
      setAlertsError('');

      try {
        const token = await getAccessToken();
        if (!token) {
          if (active) {
            setOrdersError('Session expired. Please sign in again.');
            setHealthError('Session expired. Please sign in again.');
          }
          return;
        }

        await Promise.all([fetchOrders(token, active), fetchHealthData(token, active), fetchAlerts(token, active)]);
      } catch {
        if (active) {
          setOrdersError('Network error while loading orders.');
          setHealthError('Network error while loading health data.');
          setAlertsError('Network error while loading alerts.');
        }
      } finally {
        if (active) {
          setOrdersLoading(false);
          setHealthLoading(false);
          setAlertsLoading(false);
        }
      }
    };

    loadDashboardData();
    return () => {
      active = false;
    };
  }, [isAuthenticated, user, getAccessToken, fetchOrders, fetchHealthData, fetchAlerts]);

  if (!user) return null;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--deep)',
        fontFamily: "'DM Sans', sans-serif",
        color: 'var(--white)',
      }}
    >
      <nav
        style={{
          padding: '0 5%',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(13,13,15,0.9)',
          backdropFilter: 'blur(24px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: '1.3rem',
            letterSpacing: '0.12em',
            color: 'var(--white)',
            textDecoration: 'none',
          }}
        >
          VITAR<span style={{ color: '#C0392B' }}>.</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            {user.firstName} {user.lastName}
          </span>
          <button
            onClick={logout}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '3px',
              padding: '0.5rem 1.2rem',
              color: 'var(--white)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div style={{ padding: '4rem 5%', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.8rem' }}>
            <button
              onClick={() => setDemoMode((v) => !v)}
              style={{
                background: demoMode ? 'rgba(26,188,156,0.18)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${demoMode ? 'rgba(26,188,156,0.45)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: '20px',
                color: demoMode ? '#1ABC9C' : 'var(--muted)',
                fontSize: '0.72rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '0.35rem 0.8rem',
                cursor: 'pointer',
              }}
            >
              Demo Mode: {demoMode ? 'On' : 'Off'}
            </button>
          </div>
          <div
            style={{
              fontSize: '0.72rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#C0392B',
              marginBottom: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
            }}
          >
            <span style={{ width: '24px', height: '1px', background: '#C0392B', display: 'inline-block' }} />
            Health Dashboard
          </div>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              lineHeight: 1.1,
              marginBottom: '0.5rem',
            }}
          >
            Good to have you,
            <br />
            {user.firstName}.
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
            Your cardiac health dashboard is ready. Connect your VITAR device to begin monitoring.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          {[
            {
              label: 'Device Status',
              value: healthLoading ? 'Loading...' : hasDevice ? deviceStatus : 'Not Connected',
              unit: '',
              color: hasDevice ? 'var(--white)' : 'var(--muted)',
              icon: 'D',
            },
            {
              label: 'Heart Rate',
              value: healthLoading ? '...' : heartRateValue ?? '--',
              unit: 'BPM',
              color: heartRateValue != null ? 'var(--white)' : 'var(--muted)',
              icon: 'HR',
            },
            {
              label: 'SpO2',
              value: healthLoading ? '...' : spo2Value ?? '--',
              unit: '%',
              color: spo2Value != null ? 'var(--white)' : 'var(--muted)',
              icon: 'O2',
            },
            {
              label: 'AI Risk Score',
              value: healthLoading ? '...' : riskScorePercent != null ? riskScorePercent : '--',
              unit: riskScorePercent != null ? '%' : '',
              color: riskScorePercent != null ? 'var(--white)' : 'var(--muted)',
              icon: 'AI',
            },
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
                  fontSize: '0.62rem',
                  color: 'var(--muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: '0.8rem',
                }}
              >
                {card.icon} {card.label}
              </div>
              <div
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: '2rem',
                  color: card.color,
                  lineHeight: 1,
                }}
              >
                {card.value}
              </div>
              {card.unit && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.3rem' }}>{card.unit}</div>}
            </div>
          ))}
        </div>

        {healthError && (
          <div
            style={{
              background: 'rgba(192,57,43,0.1)',
              border: '1px solid rgba(192,57,43,0.3)',
              borderRadius: '6px',
              padding: '0.8rem 1rem',
              color: '#E74C3C',
              fontSize: '0.82rem',
              marginBottom: '1.2rem',
            }}
          >
            {healthError}
          </div>
        )}

        <div
          style={{
            background: 'rgba(192,57,43,0.06)',
            border: '1px solid rgba(192,57,43,0.2)',
            borderRadius: '8px',
            padding: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 500, marginBottom: '0.3rem' }}>
              {hasDevice ? `${primaryDevice?.model ?? 'VITAR'} connected` : 'No device connected'}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              {hasDevice
                ? `Status: ${deviceStatus}${primaryDevice?.batteryLevel != null ? ` | Battery: ${primaryDevice.batteryLevel}%` : ''}`
                : 'Pre-order your VITAR device to start monitoring your cardiac health'}
            </div>
          </div>
          {!hasDevice && (
            <Link
              href="/#pricing"
              style={{
                background: '#C0392B',
                color: 'var(--white)',
                textDecoration: 'none',
                padding: '0.8rem 1.8rem',
                borderRadius: '3px',
                fontSize: '0.82rem',
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              Order a Device
            </Link>
          )}
        </div>

        <div
          style={{
            marginTop: '2rem',
            background: 'var(--graphite)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
            Device Management
          </div>

          <form onSubmit={handlePairDevice} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.6rem', marginBottom: '1rem' }}>
            <input
              value={pairSerialNumber}
              onChange={(e) => setPairSerialNumber(e.target.value)}
              placeholder="Device serial number"
              style={{
                background: 'var(--deep)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '4px',
                color: 'var(--white)',
                fontSize: '0.85rem',
                padding: '0.7rem 0.8rem',
              }}
            />
            <select
              value={pairModel}
              onChange={(e) => setPairModel(e.target.value)}
              style={{
                background: 'var(--deep)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '4px',
                color: 'var(--white)',
                fontSize: '0.85rem',
                padding: '0.7rem 0.8rem',
              }}
            >
              <option value="core">Core</option>
              <option value="pro">Pro</option>
              <option value="elite">Elite</option>
            </select>
            <button
              type="submit"
              disabled={pairing}
              style={{
                background: '#C0392B',
                border: 'none',
                borderRadius: '4px',
                color: 'var(--white)',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '0.7rem 1rem',
                cursor: pairing ? 'not-allowed' : 'pointer',
                opacity: pairing ? 0.7 : 1,
              }}
            >
              {pairing ? 'Pairing...' : 'Pair Device'}
            </button>
          </form>

          {pairSuccess && <div style={{ color: '#2ECC71', fontSize: '0.82rem', marginBottom: '0.6rem' }}>{pairSuccess}</div>}
          {pairError && <div style={{ color: '#E74C3C', fontSize: '0.82rem', marginBottom: '0.6rem' }}>{pairError}</div>}
          {demoMode && devices.length === 0 && (
            <div style={{ color: '#1ABC9C', fontSize: '0.82rem', marginBottom: '0.6rem' }}>
              Demo mode is active. Showing simulated device and health data.
            </div>
          )}

          {healthLoading ? (
            <div className="skeleton-stack" style={{ marginTop: '0.4rem' }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton-row">
                  <div className="skeleton-line long" />
                  <div className="skeleton-line mid" />
                  <div className="skeleton-line mid" />
                  <div className="skeleton-line short" />
                  <div className="skeleton-line short" />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table table-card" style={{ fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {deviceColumns.map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: '0.7rem 0.3rem',
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
                  {effectiveDevices.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td data-label={deviceColumns[0]} style={{ padding: '0.8rem 0.3rem', fontFamily: 'monospace', color: 'var(--muted)' }}>{d.serialNumber ?? 'N/A'}</td>
                      <td data-label={deviceColumns[1]} style={{ padding: '0.8rem 0.3rem' }}>{d.model ?? 'N/A'}</td>
                      <td data-label={deviceColumns[2]} style={{ padding: '0.8rem 0.3rem', color: 'var(--muted)' }}>{d.status ?? 'unknown'}</td>
                      <td data-label={deviceColumns[3]} style={{ padding: '0.8rem 0.3rem', color: 'var(--muted)' }}>{d.batteryLevel != null ? `${d.batteryLevel}%` : 'N/A'}</td>
                      <td data-label={deviceColumns[4]} style={{ padding: '0.8rem 0.3rem', color: 'var(--muted)' }}>
                        {d.lastSync ? new Date(d.lastSync).toLocaleString('en-IN') : 'N/A'}
                      </td>
                      <td data-label={deviceColumns[5]} style={{ padding: '0.8rem 0.3rem' }}>
                        {d.id === 'demo-device' ? (
                          <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>Simulated</span>
                        ) : (
                          <button
                            onClick={() => handleUnpairDevice(d.id)}
                            disabled={deviceActionLoadingId === d.id}
                            style={{
                              background: 'rgba(192,57,43,0.1)',
                              border: '1px solid rgba(192,57,43,0.3)',
                              borderRadius: '3px',
                              color: '#C0392B',
                              padding: '0.35rem 0.7rem',
                              fontSize: '0.72rem',
                              cursor: deviceActionLoadingId === d.id ? 'not-allowed' : 'pointer',
                              opacity: deviceActionLoadingId === d.id ? 0.7 : 1,
                            }}
                          >
                            {deviceActionLoadingId === d.id ? 'Removing...' : 'Unpair'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {effectiveDevices.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.8rem' }}>No devices paired yet.</p>}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: '2rem',
            background: 'var(--graphite)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Alerts ({activeAlerts.length} active)
            </div>
            <button
              onClick={triggerTestAlert}
              disabled={alertsLoading}
              style={{
                background: 'rgba(231,76,60,0.14)',
                border: '1px solid rgba(231,76,60,0.35)',
                borderRadius: '4px',
                color: '#E74C3C',
                fontSize: '0.78rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '0.5rem 0.8rem',
                cursor: alertsLoading ? 'not-allowed' : 'pointer',
                opacity: alertsLoading ? 0.7 : 1,
              }}
            >
              {alertsLoading ? 'Processing...' : 'Trigger Test Alert'}
            </button>
          </div>

          {alertsInfo && <div style={{ color: '#2ECC71', fontSize: '0.82rem', marginBottom: '0.6rem' }}>{alertsInfo}</div>}
          {alertsError && <div style={{ color: '#E74C3C', fontSize: '0.82rem', marginBottom: '0.6rem' }}>{alertsError}</div>}

          {alertsLoading && alerts.length === 0 ? (
            <div className="skeleton-stack" style={{ marginTop: '0.4rem' }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="skeleton-row">
                  <div className="skeleton-line long" />
                  <div className="skeleton-line short" />
                  <div className="skeleton-line mid" />
                  <div className="skeleton-line mid" />
                  <div className="skeleton-line short" />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table table-card" style={{ fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {alertColumns.map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: '0.7rem 0.3rem',
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
                  {alerts.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td data-label={alertColumns[0]} style={{ padding: '0.8rem 0.3rem' }}>{a.alertType}</td>
                      <td data-label={alertColumns[1]} style={{ padding: '0.8rem 0.3rem' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '20px',
                            background:
                              a.severity === 'critical'
                                ? 'rgba(231,76,60,0.1)'
                                : a.severity === 'high'
                                ? 'rgba(243,156,18,0.1)'
                                : 'rgba(255,255,255,0.05)',
                            color: a.severity === 'critical' ? '#E74C3C' : a.severity === 'high' ? '#F39C12' : 'var(--muted)',
                            border: '1px solid rgba(255,255,255,0.12)',
                          }}
                        >
                          {a.severity}
                        </span>
                      </td>
                      <td data-label={alertColumns[2]} style={{ padding: '0.8rem 0.3rem', color: 'var(--muted)' }}>{a.status}</td>
                      <td data-label={alertColumns[3]} style={{ padding: '0.8rem 0.3rem', color: 'var(--muted)', fontSize: '0.78rem' }}>
                        {new Date(a.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td data-label={alertColumns[4]} style={{ padding: '0.8rem 0.3rem', display: 'flex', gap: '0.4rem' }}>
                        {a.status === 'pending' && (
                          <button
                            onClick={() => updateAlertStatus(a.id, 'acknowledged')}
                            disabled={alertActionLoadingId === a.id}
                            style={{
                              background: 'rgba(52,152,219,0.14)',
                              border: '1px solid rgba(52,152,219,0.35)',
                              borderRadius: '3px',
                              color: '#3498DB',
                              padding: '0.35rem 0.6rem',
                              fontSize: '0.72rem',
                              cursor: alertActionLoadingId === a.id ? 'not-allowed' : 'pointer',
                              opacity: alertActionLoadingId === a.id ? 0.7 : 1,
                            }}
                          >
                            Acknowledge
                          </button>
                        )}
                        {a.status === 'acknowledged' && (
                          <button
                            onClick={() => updateAlertStatus(a.id, 'resolved')}
                            disabled={alertActionLoadingId === a.id}
                            style={{
                              background: 'rgba(46,204,113,0.14)',
                              border: '1px solid rgba(46,204,113,0.35)',
                              borderRadius: '3px',
                              color: '#2ECC71',
                              padding: '0.35rem 0.6rem',
                              fontSize: '0.72rem',
                              cursor: alertActionLoadingId === a.id ? 'not-allowed' : 'pointer',
                              opacity: alertActionLoadingId === a.id ? 0.7 : 1,
                            }}
                          >
                            Resolve
                          </button>
                        )}
                        {(a.status === 'resolved' || a.status === 'dismissed') && (
                          <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>Closed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {alerts.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.8rem' }}>No alerts yet.</p>}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: '2rem',
            background: 'var(--graphite)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
            Account Details
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Name', value: `${user.firstName} ${user.lastName}` },
              { label: 'Email', value: user.email },
              { label: 'Account Type', value: user.role.charAt(0).toUpperCase() + user.role.slice(1) },
              { label: 'Subscription', value: 'No active plan' },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '0.9rem' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: '2rem',
            background: 'var(--graphite)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Recent Orders
            </div>
            <Link href="/#pricing" style={{ color: '#C0392B', textDecoration: 'none', fontSize: '0.78rem' }}>
              New order
            </Link>
          </div>

          {ordersLoading && (
            <div className="skeleton-stack" style={{ marginTop: '0.6rem' }}>
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="skeleton-row">
                  <div className="skeleton-line long" />
                  <div className="skeleton-line mid" />
                  <div className="skeleton-line short" />
                  <div className="skeleton-line short" />
                  <div className="skeleton-line mid" />
                </div>
              ))}
            </div>
          )}

          {!ordersLoading && ordersError && (
            <div
              style={{
                background: 'rgba(192,57,43,0.1)',
                border: '1px solid rgba(192,57,43,0.3)',
                borderRadius: '6px',
                padding: '0.8rem 1rem',
                color: '#E74C3C',
                fontSize: '0.82rem',
              }}
            >
              {ordersError}
            </div>
          )}

          {!ordersLoading && !ordersError && recentOrders.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No orders yet. Reserve your first device.</p>
          )}

          {!ordersLoading && !ordersError && recentOrders.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table table-card" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {orderColumns.map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '0.7rem 0.2rem',
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
                  {recentOrders.map((o) => (
                    <tr key={o.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td data-label={orderColumns[0]} style={{ padding: '0.9rem 0.2rem', fontFamily: 'monospace', color: '#C0392B', fontSize: '0.78rem' }}>
                        {o.order_number}
                      </td>
                      <td data-label={orderColumns[1]} style={{ padding: '0.9rem 0.2rem', color: 'var(--muted)' }}>VITAR {o.device_model}</td>
                      <td data-label={orderColumns[2]} style={{ padding: '0.9rem 0.2rem' }}>
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
                      <td data-label={orderColumns[3]} style={{ padding: '0.9rem 0.2rem', color: '#2ECC71', fontWeight: 500 }}>
                        ${((o.total ?? 0) / 100).toFixed(2)} {o.currency?.toUpperCase()}
                      </td>
                      <td data-label={orderColumns[4]} style={{ padding: '0.9rem 0.2rem', color: 'var(--muted)', fontSize: '0.78rem' }}>
                        {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


