'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSignup } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SignupForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
};

const validateSignup = (form: SignupForm) => {
  const errors: Partial<Record<keyof SignupForm, string>> = {};

  if (!form.firstName.trim()) errors.firstName = 'First name is required.';
  if (!form.lastName.trim()) errors.lastName = 'Last name is required.';

  if (!form.email.trim()) errors.email = 'Email is required.';
  else if (!emailPattern.test(form.email.trim())) errors.email = 'Enter a valid email address.';

  if (!form.password) errors.password = 'Password is required.';
  else if (form.password.length < 8) errors.password = 'Use at least 8 characters.';

  if (!form.confirm) errors.confirm = 'Please confirm your password.';
  else if (form.password !== form.confirm) errors.confirm = 'Passwords do not match.';

  return errors;
};

export default function SignupPage() {
  const { signup, loading, error, setError } = useSignup();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirm: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof SignupForm, string>>>({});
  const [touched, setTouched] = useState<Record<keyof SignupForm, boolean>>({
    firstName: false,
    lastName: false,
    email: false,
    password: false,
    confirm: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target as { name: keyof SignupForm; value: string };
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      setFieldErrors(validateSignup(next));
      return next;
    });
    setError(null);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target as { name: keyof SignupForm };
    setTouched((prev) => ({ ...prev, [name]: true }));
    setFieldErrors(validateSignup(form));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateSignup(form);
    setFieldErrors(errors);
    setTouched({ firstName: true, lastName: true, email: true, password: true, confirm: true });
    if (Object.keys(errors).length > 0) return;

    await signup({
      firstName: form.firstName,
      lastName:  form.lastName,
      email:     form.email,
      password:  form.password,
    });
  };

  const resolveInputStyle = (name: keyof SignupForm) => {
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

  return (
    <div style={{
      minHeight: '100vh', background: '#0D0D0F',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Logo */}
        <Link href="/" style={{
          fontFamily: "'DM Serif Display', serif", fontSize: '1.5rem',
          letterSpacing: '0.12em', color: '#F9F8F6', textDecoration: 'none',
          display: 'block', marginBottom: '2.5rem',
        }}>
          VITAR<span style={{ color: '#C0392B' }}>.</span>
        </Link>

        {/* Card */}
        <div style={{
          background: '#1A1A1C', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px', padding: '2.5rem',
        }}>
          <h1 style={{
            fontFamily: "'DM Serif Display', serif", fontSize: '1.8rem',
            color: '#F9F8F6', marginBottom: '0.4rem',
          }}>Create your account</h1>
          <p style={{ fontSize: '0.82rem', color: '#8A8A8E', marginBottom: '2rem' }}>
            Join thousands protecting their hearts with VITAR
          </p>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)',
              borderRadius: '4px', padding: '0.8rem 1rem',
              fontSize: '0.82rem', color: '#E74C3C', marginBottom: '1.2rem',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
              <div>
                <label style={labelStyle}>First Name</label>
                <input
                  name="firstName" value={form.firstName} onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Jordan" required style={resolveInputStyle('firstName')}
                />
                {touched.firstName && fieldErrors.firstName && <div style={fieldErrorStyle}>{fieldErrors.firstName}</div>}
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input
                  name="lastName" value={form.lastName} onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Smith" required style={resolveInputStyle('lastName')}
                />
                {touched.lastName && fieldErrors.lastName && <div style={fieldErrorStyle}>{fieldErrors.lastName}</div>}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                name="email" type="email" value={form.email} onChange={handleChange}
                onBlur={handleBlur}
                placeholder="you@example.com" required style={resolveInputStyle('email')}
              />
              {touched.email && fieldErrors.email && <div style={fieldErrorStyle}>{fieldErrors.email}</div>}
              {touched.email && !fieldErrors.email && form.email.trim().length > 0 && <div style={fieldOkStyle}>Email format looks good.</div>}
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input
                name="password" type="password" value={form.password} onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Min. 8 characters" required minLength={8} style={resolveInputStyle('password')}
              />
              {touched.password && fieldErrors.password && <div style={fieldErrorStyle}>{fieldErrors.password}</div>}
              {form.password.length > 0 && form.password.length < 8 && <div style={fieldHintStyle}>Use at least 8 characters for better security.</div>}
            </div>

            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input
                name="confirm" type="password" value={form.confirm} onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Repeat your password" required style={resolveInputStyle('confirm')}
              />
              {touched.confirm && fieldErrors.confirm && <div style={fieldErrorStyle}>{fieldErrors.confirm}</div>}
              {touched.confirm && !fieldErrors.confirm && form.confirm.length > 0 && <div style={fieldOkStyle}>Passwords match.</div>}
            </div>

            <Button variant="primary" size="md" type="submit" disabled={loading} style={{
              width: '100%',
              borderRadius: '3px',
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'wait' : 'pointer',
              marginTop: '0.5rem',
            }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#8A8A8E', fontSize: '0.75rem' }}>
              <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              or
              <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* OAuth buttons */}
            <div style={{ display: 'flex', gap: '0.7rem' }}>
              <button type="button" style={oauthStyle}>🍎 Apple</button>
              <button type="button" style={oauthStyle}>🔵 Google</button>
            </div>
          </form>
        </div>

        {/* Sign in link */}
        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.82rem', color: '#8A8A8E' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#C0392B', textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>

        {/* Disclaimer */}
        <p style={{
          textAlign: 'center', marginTop: '1rem', fontSize: '0.68rem',
          color: 'rgba(255,255,255,0.3)', lineHeight: '1.5',
        }}>
          Your health data is encrypted end-to-end and never shared.
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em',
  textTransform: 'uppercase', color: '#8A8A8E', marginBottom: '0.4rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0D0D0F',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px',
  padding: '0.85rem 1rem', color: '#F9F8F6',
  fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem',
  outline: 'none', boxSizing: 'border-box',
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

const fieldHintStyle: React.CSSProperties = {
  marginTop: '0.45rem',
  color: '#8A8A8E',
  fontSize: '0.72rem',
  lineHeight: 1.4,
};

const oauthStyle: React.CSSProperties = {
  flex: 1, padding: '0.8rem', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px',
  color: '#F9F8F6', fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.82rem', cursor: 'pointer',
};
