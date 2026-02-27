'use client';

import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';

export default function OrderCancelledPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0D0D0F',
        color: '#F9F8F6',
        fontFamily: "'DM Sans', sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <Link
          href="/"
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: '1.5rem',
            letterSpacing: '0.12em',
            color: '#F9F8F6',
            textDecoration: 'none',
            display: 'block',
            marginBottom: '2rem',
          }}
        >
          VITAR<span style={{ color: '#C0392B' }}>.</span>
        </Link>

        <div
          style={{
            background: '#1A1A1C',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '2.3rem',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(255,193,7,0.1)',
              border: '2px solid rgba(255,193,7,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              marginBottom: '1.3rem',
              color: '#FFC107',
            }}
          >
            !
          </div>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '2rem',
              marginBottom: '0.4rem',
            }}
          >
            Checkout cancelled
          </h1>
          <p style={{ color: '#8A8A8E', fontSize: '0.92rem', lineHeight: 1.7, marginBottom: '1.3rem' }}>
            No worries. Your reservation was not finalized. You can restart anytime.
          </p>

          <div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap' }}>
            <ButtonLink href="/#pricing" variant="primary" size="sm" style={{ borderRadius: '3px' }}>
              Try Again
            </ButtonLink>
            <ButtonLink href="/" variant="ghost" size="sm" style={{ borderRadius: '3px' }}>
              Back to Home
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
