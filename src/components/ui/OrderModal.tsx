'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';

type DeviceModel = 'core' | 'pro' | 'elite';
type OrderFormFields = {
  firstName: string;
  lastName: string;
  email: string;
  acceptDisclaimer: boolean;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateOrderForm(fields: OrderFormFields) {
  const errors: Partial<Record<keyof OrderFormFields, string>> = {};

  if (!fields.firstName.trim()) errors.firstName = 'First name is required.';
  if (!fields.lastName.trim()) errors.lastName = 'Last name is required.';

  if (!fields.email.trim()) errors.email = 'Email is required.';
  else if (!emailPattern.test(fields.email.trim())) errors.email = 'Enter a valid email address.';

  if (!fields.acceptDisclaimer) {
    errors.acceptDisclaimer = 'Please accept the medical disclaimer to continue.';
  }

  return errors;
}

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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof OrderFormFields, string>>>({});
  const [touched, setTouched] = useState<Record<'firstName' | 'lastName' | 'email', boolean>>({
    firstName: false,
    lastName: false,
    email: false,
  });
  const [disclaimerTouched, setDisclaimerTouched] = useState(false);

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

    const validation = validateOrderForm({
      firstName,
      lastName,
      email,
      acceptDisclaimer,
    });
    setFieldErrors(validation);
    setTouched({ firstName: true, lastName: true, email: true });
    setDisclaimerTouched(true);
    if (Object.keys(validation).length > 0) return;

    if (!isAuthenticated) {
      setError('Please sign in first to place an order.');
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

  const handleBlur = (field: 'firstName' | 'lastName' | 'email') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setFieldErrors(
      validateOrderForm({
        firstName,
        lastName,
        email,
        acceptDisclaimer,
      })
    );
  };

  const resolveInputState = (field: 'firstName' | 'lastName' | 'email'): React.CSSProperties => {
    const value = field === 'firstName' ? firstName : field === 'lastName' ? lastName : email;
    const hasError = touched[field] && Boolean(fieldErrors[field]);
    const isValid = touched[field] && !fieldErrors[field] && value.trim().length > 0;

    return {
      border: hasError
        ? '1px solid rgba(231,76,60,0.55)'
        : isValid
        ? '1px solid rgba(46,204,113,0.55)'
        : undefined,
      boxShadow: hasError
        ? '0 0 0 2px rgba(231,76,60,0.15)'
        : isValid
        ? '0 0 0 2px rgba(46,204,113,0.12)'
        : undefined,
    };
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
              <input
                className="f-inp"
                type="text"
                style={{ marginTop: '.4rem', ...resolveInputState('firstName') }}
                value={firstName}
                onBlur={() => handleBlur('firstName')}
                onChange={(e) => {
                  const next = e.target.value;
                  setFirstName(next);
                  setError('');
                  setFieldErrors(
                    validateOrderForm({
                      firstName: next,
                      lastName,
                      email,
                      acceptDisclaimer,
                    })
                  );
                }}
                required
              />
              {touched.firstName && fieldErrors.firstName && <div style={fieldErrorStyle}>{fieldErrors.firstName}</div>}
            </div>
            <div>
              <label className="f-lbl">Last Name</label>
              <input
                className="f-inp"
                type="text"
                style={{ marginTop: '.4rem', ...resolveInputState('lastName') }}
                value={lastName}
                onBlur={() => handleBlur('lastName')}
                onChange={(e) => {
                  const next = e.target.value;
                  setLastName(next);
                  setError('');
                  setFieldErrors(
                    validateOrderForm({
                      firstName,
                      lastName: next,
                      email,
                      acceptDisclaimer,
                    })
                  );
                }}
                required
              />
              {touched.lastName && fieldErrors.lastName && <div style={fieldErrorStyle}>{fieldErrors.lastName}</div>}
            </div>
          </div>

          <div>
            <label className="f-lbl">Email</label>
            <input
              className="f-inp"
              type="email"
              style={{ marginTop: '.4rem', ...resolveInputState('email') }}
              value={email}
              onBlur={() => handleBlur('email')}
              onChange={(e) => {
                const next = e.target.value;
                setEmail(next);
                setError('');
                setFieldErrors(
                  validateOrderForm({
                    firstName,
                    lastName,
                    email: next,
                    acceptDisclaimer,
                  })
                );
              }}
              required
            />
            {touched.email && fieldErrors.email && <div style={fieldErrorStyle}>{fieldErrors.email}</div>}
            {touched.email && !fieldErrors.email && email.trim().length > 0 && <div style={fieldOkStyle}>Email format looks good.</div>}
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
              onBlur={() => setDisclaimerTouched(true)}
              style={{ marginTop: '2px', accentColor: 'var(--accent)' }}
            />
            I acknowledge the medical disclaimer and Terms of Service.
          </label>
          {disclaimerTouched && fieldErrors.acceptDisclaimer && <div style={fieldErrorStyle}>{fieldErrors.acceptDisclaimer}</div>}

          <Button variant="primary" size="md" style={{ width: '100%', borderRadius: '3px', border: 'none' }} type="submit" disabled={loading}>
            {loading ? 'Processing...' : 'Secure Pre-Order'}
          </Button>
          {loading && <div style={fieldHintStyle}>Preparing secure checkout...</div>}
        </form>
      </div>
    </div>
  );
}

const fieldErrorStyle: React.CSSProperties = {
  marginTop: '0.45rem',
  color: '#E74C3C',
  fontSize: '0.74rem',
  lineHeight: 1.4,
};

const fieldOkStyle: React.CSSProperties = {
  marginTop: '0.45rem',
  color: '#2ECC71',
  fontSize: '0.74rem',
  lineHeight: 1.4,
};

const fieldHintStyle: React.CSSProperties = {
  marginTop: '0.2rem',
  color: 'var(--muted)',
  fontSize: '0.72rem',
  lineHeight: 1.4,
};
