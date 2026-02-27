'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

type ResetForm = {
  password: string;
  confirm: string;
};

type ResetFormErrors = {
  password?: string;
  confirm?: string;
};

const validateResetForm = (form: ResetForm) => {
  const errors: ResetFormErrors = {};

  if (!form.password) errors.password = 'Password is required.';
  else if (form.password.length < 8) errors.password = 'Use at least 8 characters.';

  if (!form.confirm) errors.confirm = 'Please confirm your password.';
  else if (form.password !== form.confirm) errors.confirm = 'Passwords do not match.';

  return errors;
};

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';
  const tokenError = !token
    ? 'Reset token is missing. Please use the link from your email.'
    : token.length < 64
      ? 'Reset token looks invalid. Please request a new reset link.'
      : '';

  const [form, setForm] = useState<ResetForm>({ password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState<ResetFormErrors>({});
  const [touched, setTouched] = useState<{ password: boolean; confirm: boolean }>({
    password: false,
    confirm: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (name: keyof ResetForm, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      setFieldErrors(validateResetForm(next));
      return next;
    });
    if (error) setError('');
  };

  const handleBlur = (name: keyof ResetForm) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setFieldErrors(validateResetForm(form));
  };

  const resolveInputStyle = (name: keyof ResetForm) => {
    const hasError = touched[name] && Boolean(fieldErrors[name]);
    const hasValue = form[name].length > 0;
    const isValid = touched[name] && !fieldErrors[name] && hasValue;

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (tokenError) {
      setError(tokenError);
      return;
    }

    const errors = validateResetForm(form);
    setFieldErrors(errors);
    setTouched({ password: true, confirm: true });
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: form.password }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || 'Failed to reset password.');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 1500);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
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
          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(46,204,113,0.1)',
                  border: '2px solid #2ECC71',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  margin: '0 auto 1.5rem',
                  color: '#2ECC71',
                }}
              >
                OK
              </div>
              <h1
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: '1.8rem',
                  color: '#F9F8F6',
                  marginBottom: '0.5rem',
                }}
              >
                Password updated
              </h1>
              <p style={{ fontSize: '0.85rem', color: '#8A8A8E', lineHeight: '1.7' }}>Redirecting you to sign in...</p>
            </div>
          ) : (
            <>
              <h1
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: '1.8rem',
                  color: '#F9F8F6',
                  marginBottom: '0.5rem',
                }}
              >
                Set new password
              </h1>
              <p style={{ fontSize: '0.82rem', color: '#8A8A8E', marginBottom: '2rem' }}>
                Enter a new password for your VITAR account
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

              {tokenError ? (
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
                  {tokenError}
                </div>
              ) : (
                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => handleChange('password', e.target.value)}
                        onBlur={() => handleBlur('password')}
                        placeholder="Min. 8 characters"
                        minLength={8}
                        required
                        style={{ ...resolveInputStyle('password'), paddingRight: '5.5rem' }}
                      />
                      <button type="button" onClick={() => setShowPassword((v) => !v)} style={toggleStyle}>
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {touched.password && fieldErrors.password && <div style={fieldErrorStyle}>{fieldErrors.password}</div>}
                    {touched.password && !fieldErrors.password && form.password.length > 0 && (
                      <div style={fieldOkStyle}>Password length looks good.</div>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Confirm Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={form.confirm}
                        onChange={(e) => handleChange('confirm', e.target.value)}
                        onBlur={() => handleBlur('confirm')}
                        placeholder="Repeat your password"
                        required
                        style={{ ...resolveInputStyle('confirm'), paddingRight: '5.5rem' }}
                      />
                      <button type="button" onClick={() => setShowConfirm((v) => !v)} style={toggleStyle}>
                        {showConfirm ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {touched.confirm && fieldErrors.confirm && <div style={fieldErrorStyle}>{fieldErrors.confirm}</div>}
                    {touched.confirm && !fieldErrors.confirm && form.confirm.length > 0 && (
                      <div style={fieldOkStyle}>Passwords match.</div>
                    )}
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
                      cursor: loading ? 'wait' : 'pointer',
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.82rem', color: '#8A8A8E' }}>
          {tokenError ? (
            <>
              Need a new link?{' '}
              <Link href="/forgot-password" style={{ color: '#C0392B', textDecoration: 'none' }}>
                Request reset
              </Link>
            </>
          ) : (
            <>
              Back to{' '}
              <Link href="/login" style={{ color: '#C0392B', textDecoration: 'none' }}>
                sign in
              </Link>
            </>
          )}
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
  marginBottom: '0.4rem',
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

const toggleStyle: React.CSSProperties = {
  position: 'absolute',
  right: '0.55rem',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '3px',
  color: '#8A8A8E',
  padding: '0.25rem 0.55rem',
  fontSize: '0.72rem',
  cursor: 'pointer',
};

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            background: '#0D0D0F',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8A8A8E',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Loading...
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
