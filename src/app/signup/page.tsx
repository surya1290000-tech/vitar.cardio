'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSignup } from '@/hooks/useAuth';

export default function SignupPage() {
  const { signup, loading, error, setError } = useSignup();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirm: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    await signup({
      firstName: form.firstName,
      lastName:  form.lastName,
      email:     form.email,
      password:  form.password,
    });
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
                  placeholder="Jordan" required style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input
                  name="lastName" value={form.lastName} onChange={handleChange}
                  placeholder="Smith" required style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                name="email" type="email" value={form.email} onChange={handleChange}
                placeholder="you@example.com" required style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input
                name="password" type="password" value={form.password} onChange={handleChange}
                placeholder="Min. 8 characters" required minLength={8} style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input
                name="confirm" type="password" value={form.confirm} onChange={handleChange}
                placeholder="Repeat your password" required style={inputStyle}
              />
            </div>

            <button type="submit" disabled={loading} style={{
              ...btnStyle,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'wait' : 'pointer',
              marginTop: '0.5rem',
            }}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

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

const btnStyle: React.CSSProperties = {
  width: '100%', background: '#C0392B', color: '#F9F8F6',
  border: 'none', borderRadius: '3px', padding: '0.95rem',
  fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem',
  fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase',
};

const oauthStyle: React.CSSProperties = {
  flex: 1, padding: '0.8rem', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px',
  color: '#F9F8F6', fontFamily: "'DM Sans', sans-serif",
  fontSize: '0.82rem', cursor: 'pointer',
};
