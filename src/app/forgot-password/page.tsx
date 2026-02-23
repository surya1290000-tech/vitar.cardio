'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useForgotPassword } from '@/hooks/useAuth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const { forgotPassword, loading, success, error } = useForgotPassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await forgotPassword(email);
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0D0D0F',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        <Link href="/" style={{
          fontFamily: "'DM Serif Display', serif", fontSize: '1.5rem',
          letterSpacing: '0.12em', color: '#F9F8F6', textDecoration: 'none',
          display: 'block', marginBottom: '2.5rem',
        }}>
          VITAR<span style={{ color: '#C0392B' }}>.</span>
        </Link>

        <div style={{
          background: '#1A1A1C', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px', padding: '2.5rem',
        }}>
          {success ? (
            // Success state
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(46,204,113,0.1)', border: '2px solid #2ECC71',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.5rem', margin: '0 auto 1.5rem',
              }}>✓</div>
              <h1 style={{
                fontFamily: "'DM Serif Display', serif", fontSize: '1.8rem',
                color: '#F9F8F6', marginBottom: '0.5rem',
              }}>Check your email</h1>
              <p style={{ fontSize: '0.85rem', color: '#8A8A8E', lineHeight: '1.7', marginBottom: '2rem' }}>
                If an account exists for <strong style={{ color: '#F9F8F6' }}>{email}</strong>,
                we&apos;ve sent a password reset link. It expires in 1 hour.
              </p>
              <Link href="/login" style={{
                display: 'block', width: '100%', background: '#C0392B',
                color: '#F9F8F6', textDecoration: 'none', borderRadius: '3px',
                padding: '0.95rem', textAlign: 'center', fontSize: '0.9rem',
                fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase',
                boxSizing: 'border-box',
              }}>
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h1 style={{
                fontFamily: "'DM Serif Display', serif", fontSize: '1.8rem',
                color: '#F9F8F6', marginBottom: '0.5rem',
              }}>Reset your password</h1>
              <p style={{ fontSize: '0.82rem', color: '#8A8A8E', marginBottom: '2rem' }}>
                Enter your email and we&apos;ll send you a reset link
              </p>

              {error && (
                <div style={{
                  background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)',
                  borderRadius: '4px', padding: '0.8rem 1rem',
                  fontSize: '0.82rem', color: '#E74C3C', marginBottom: '1.2rem',
                }}>{error}</div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block', fontSize: '0.72rem', letterSpacing: '0.08em',
                    textTransform: 'uppercase', color: '#8A8A8E', marginBottom: '0.4rem',
                  }}>Email Address</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required autoFocus
                    style={{
                      width: '100%', background: '#0D0D0F',
                      border: '1px solid rgba(255,255,255,0.08)', borderRadius: '3px',
                      padding: '0.85rem 1rem', color: '#F9F8F6',
                      fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <button type="submit" disabled={loading} style={{
                  width: '100%', background: '#C0392B', color: '#F9F8F6',
                  border: 'none', borderRadius: '3px', padding: '0.95rem',
                  fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem',
                  fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase',
                  cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
                }}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.82rem', color: '#8A8A8E' }}>
          Remember your password?{' '}
          <Link href="/login" style={{ color: '#C0392B', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
