'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLogin } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateLogin = (form: { email: string; password: string }) => {
  const errors: { email?: string; password?: string } = {};
  const email = form.email.trim();

  if (!email) errors.email = 'Email is required.';
  else if (!emailPattern.test(email)) errors.email = 'Enter a valid email address.';

  if (!form.password) errors.password = 'Password is required.';

  return errors;
};

export default function LoginPage() {
  const { login, loginWithGoogle, loading, error, setError } = useLogin();
  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    if (!document.getElementById('google-identity-script')) {
      const script = document.createElement('script');
      script.id = 'google-identity-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      setFieldErrors(validateLogin(next));
      return next;
    });
    setError(null);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target as { name: 'email' | 'password' };
    setTouched((prev) => ({ ...prev, [name]: true }));
    setFieldErrors(validateLogin(form));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateLogin(form);
    setFieldErrors(errors);
    setTouched({ email: true, password: true });
    if (Object.keys(errors).length > 0) return;
    await login(form, { redirectTo: '/' });
  };

  const resolveInputStyle = (name: 'email' | 'password') => {
    const hasError = touched[name] && Boolean(fieldErrors[name]);
    const isValid = touched[name] && !fieldErrors[name] && form[name].trim().length > 0;

    return {
      ...inputStyle,
      border: hasError
        ? '1px solid rgba(231,76,60,0.55)'
        : isValid
        ? '1px solid rgba(46,204,113,0.55)'
        : inputStyle.border,
      boxShadow: hasError
        ? '0 0 0 2px rgba(231,76,60,0.15)'
        : isValid
        ? '0 0 0 2px rgba(46,204,113,0.12)'
        : 'none',
    } as React.CSSProperties;
  };

  const handleGoogleSignIn = async () => {
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      setError('Google sign-in is not configured yet.');
      return;
    }

    const w = window as any;
    if (!w.google?.accounts?.id) {
      setError('Google sign-in script is still loading. Try again.');
      return;
    }

    setOauthLoading(true);
    setError(null);

    w.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response: any) => {
        await loginWithGoogle(response?.credential, { redirectTo: '/' });
        setOauthLoading(false);
      },
    });
    w.google.accounts.id.prompt();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0D0D0F',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <Link
          href="/"
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: '1.5rem',
            letterSpacing: '0.12em',
            color: '#F9F8F6',
            textDecoration: 'none',
            display: 'block',
            marginBottom: '2.5rem',
          }}
        >
          VITAR<span style={{ color: '#C0392B' }}>.</span>
        </Link>

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
              fontSize: '1.8rem',
              color: '#F9F8F6',
              marginBottom: '0.4rem',
            }}
          >
            Welcome back.
          </h1>
          <p style={{ fontSize: '0.82rem', color: '#8A8A8E', marginBottom: '2rem' }}>
            Sign in to your VITAR health dashboard
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

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="you@example.com"
                required
                autoFocus
                style={resolveInputStyle('email')}
              />
              {touched.email && fieldErrors.email && <div style={fieldErrorStyle}>{fieldErrors.email}</div>}
              {touched.email && !fieldErrors.email && form.email.trim().length > 0 && <div style={fieldOkStyle}>Email format looks good.</div>}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={labelStyle}>Password</label>
                <Link href="/forgot-password" style={{ fontSize: '0.72rem', color: '#C0392B', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="********"
                required
                style={resolveInputStyle('password')}
              />
              {touched.password && fieldErrors.password && <div style={fieldErrorStyle}>{fieldErrors.password}</div>}
              {touched.password && !fieldErrors.password && form.password.length > 0 && <div style={fieldOkStyle}>Password entered.</div>}
            </div>

            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                borderRadius: '3px',
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'wait' : 'pointer',
                marginTop: '0.5rem',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In Securely'}
            </Button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#8A8A8E', fontSize: '0.75rem' }}>
              <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              or continue with
              <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <div style={{ display: 'flex', gap: '0.7rem' }}>
              <button type="button" style={oauthStyle} onClick={() => setError('Apple sign-in is coming soon.')}>
                Apple
              </button>
              <button type="button" style={oauthStyle} onClick={handleGoogleSignIn} disabled={oauthLoading}>
                {oauthLoading ? 'Google...' : 'Google'}
              </button>
            </div>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.82rem', color: '#8A8A8E' }}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={{ color: '#C0392B', textDecoration: 'none' }}>
            Create one free
          </Link>
        </p>

        <p
          style={{
            textAlign: 'center',
            marginTop: '1rem',
            fontSize: '0.68rem',
            color: 'rgba(255,255,255,0.3)',
            lineHeight: '1.5',
          }}
        >
          Protected by 256-bit encryption. HIPAA-compliant by design.
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#8A8A8E',
};

const inputStyle: React.CSSProperties = {
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
};

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

const oauthStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.8rem',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '3px',
  color: '#F9F8F6',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.82rem',
  cursor: 'pointer',
};
