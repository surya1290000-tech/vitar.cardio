'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

type DeviceModel = 'core' | 'pro' | 'elite';

function closeOrderModal() {
  document.getElementById('orderModal')?.classList.remove('open');
}

export default function OrderModal() {
  const { user, accessToken, isAuthenticated, setUser } = useAuthStore();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [deviceModel, setDeviceModel] = useState<DeviceModel>('pro');
  const [acceptDisclaimer, setAcceptDisclaimer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
      setEmail(user.email ?? '');
    }
  }, [user]);

  const ensureAccessToken = async () => {
    if (accessToken) return accessToken;
    if (!user) return null;

    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok || !json?.accessToken) return null;

    setUser(user, json.accessToken);
    return json.accessToken as string;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isAuthenticated) {
      setError('Please sign in first to place an order.');
      return;
    }

    if (!acceptDisclaimer) {
      setError('Please accept the medical disclaimer to continue.');
      return;
    }

    const token = await ensureAccessToken();
    if (!token) {
      setError('Your session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceModel,
          firstName,
          lastName,
          email,
          medicalDisclaimerAccepted: acceptDisclaimer,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Failed to create order.');
        return;
      }

      if (json?.checkoutUrl) {
        window.location.href = json.checkoutUrl;
      } else {
        setError('Checkout session created, but no redirect URL was returned.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) closeOrderModal();
  };

  return (
    <div className="modal-ov" id="orderModal" onClick={onOverlayClick}>
      <div className="modal">
        <button className="modal-x" type="button" onClick={closeOrderModal}>
          x
        </button>
        <div className="modal-title">Reserve Your VITAR</div>
        <div className="modal-sub">Secure your device today.</div>

        {error && (
          <div
            style={{
              background: 'rgba(192,57,43,0.1)',
              border: '1px solid rgba(192,57,43,0.3)',
              borderRadius: '4px',
              padding: '0.8rem 1rem',
              fontSize: '0.82rem',
              color: '#E74C3C',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form className="f-form" onSubmit={onSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem' }}>
            <div>
              <label className="f-lbl">First Name</label>
              <input className="f-inp" type="text" style={{ marginTop: '.4rem' }} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <label className="f-lbl">Last Name</label>
              <input className="f-inp" type="text" style={{ marginTop: '.4rem' }} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="f-lbl">Email</label>
            <input className="f-inp" type="email" style={{ marginTop: '.4rem' }} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div>
            <label className="f-lbl">Device Model</label>
            <select className="f-inp" style={{ marginTop: '.4rem', cursor: 'pointer' }} value={deviceModel} onChange={(e) => setDeviceModel(e.target.value as DeviceModel)}>
              <option value="core">VITAR Core - $299</option>
              <option value="pro">VITAR Pro - $499</option>
              <option value="elite">VITAR Elite - $799</option>
            </select>
          </div>

          <div style={{ background: 'rgba(192,57,43,.06)', border: '1px solid rgba(192,57,43,.2)', borderRadius: '3px', padding: '1rem', fontSize: '.75rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--white)' }}>Medical Disclaimer:</strong> VITAR is an assistive wellness device and does not replace professional medical advice, diagnosis, or treatment.
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '.7rem', fontSize: '.78rem', color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={acceptDisclaimer}
              onChange={(e) => setAcceptDisclaimer(e.target.checked)}
              style={{ marginTop: '2px', accentColor: 'var(--accent)' }}
            />
            I acknowledge the medical disclaimer and Terms of Service.
          </label>

          <button className="btn-p" style={{ width: '100%', borderRadius: '3px', border: 'none', padding: '.9rem' }} type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Secure Pre-Order'}
          </button>
        </form>
      </div>
    </div>
  );
}

