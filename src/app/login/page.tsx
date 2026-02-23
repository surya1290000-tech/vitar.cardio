'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLogin } from '@/hooks/useAuth';

export default function LoginPage() {
  const { login, loading, error, setError } = useLogin();
  const [form, setForm] = useState({ email: '', password: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(form);
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
          }}>Welcome back.</h1>
          <p style={{ fontSize: '0.82rem', color: '#8A8A8E', marginBottom: '2rem' }}>
            Sign in to your VITAR health dashboard
          </p>

          {/* Error banner */}
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
            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                name="email" type="email" value={form.email} onChange={handleChange}
                placeholder="you@example.com" required autoFocus style={inputStyle}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={labelStyle}>Password</label>
                <Link href="/forgot-password" style={{ fontSize: '0.72rem', color: '#C0392B', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>
              <input
                name="password" type="password" value={form.password} onChange={handleChange}
                placeholder="••••••••" required style={inputStyle}
              />
            </div>

            <button type="submit" disabled={loading} style={{
              ...btnStyle,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'wait' : 'pointer',
              marginTop: '0.5rem',
            }}>
              {loading ? 'Signing in...' : 'Sign In Securely'}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#8A8A8E', fontSize: '0.75rem' }}>
              <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              or continue with
              <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <div style={{ display: 'flex', gap: '0.7rem' }}>
              <button type="button" style={oauthStyle}>🍎 Apple</button>
              <button type="button" style={oauthStyle}>🔵 Google</button>
            </div>
          </form>
        </div>

        {/* Sign up link */}
        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.82rem', color: '#8A8A8E' }}>
          Don&apos;t have an account?{' '}
          <Link href="/signup" style={{ color: '#C0392B', textDecoration: 'none' }}>
            Create one free
          </Link>
        </p>

        <p style={{
          textAlign: 'center', marginTop: '1rem', fontSize: '0.68rem',
          color: 'rgba(255,255,255,0.3)', lineHeight: '1.5',
        }}>
          Protected by 256-bit encryption. HIPAA-compliant by design.
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em',
  textTransform: 'uppercase', color: '#8A8A8E',
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
