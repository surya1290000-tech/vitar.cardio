'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

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

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || '';
  const { accessToken } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [resolvedOrder, setResolvedOrder] = useState<Order | null>(null);

  const hasSessionId = useMemo(() => Boolean(sessionId), [sessionId]);

  useEffect(() => {
    let active = true;

    const fetchOrder = async () => {
      if (!sessionId) return;
      setLoading(true);
      try {
        let token = accessToken;

        if (!token) {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });
          const refreshJson = await refreshRes.json();
          if (refreshRes.ok && refreshJson?.accessToken) token = refreshJson.accessToken;
        }

        if (!token) return;

        const res = await fetch('/api/orders', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!res.ok || !Array.isArray(json?.orders)) return;

        const match = (json.orders as Order[]).find((o) => o.stripe_session_id === sessionId) || null;
        if (active) setResolvedOrder(match);
      } catch {
        // keep page resilient
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchOrder();
    return () => {
      active = false;
    };
  }, [sessionId, accessToken]);

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
              background: 'rgba(46,204,113,0.1)',
              border: '2px solid #2ECC71',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              marginBottom: '1.3rem',
              color: '#2ECC71',
            }}
          >
            ✓
          </div>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '2rem',
              marginBottom: '0.4rem',
            }}
          >
            Order initiated
          </h1>
          <p style={{ color: '#8A8A8E', fontSize: '0.92rem', lineHeight: 1.7, marginBottom: '1.3rem' }}>
            Your checkout completed. We will confirm reservation status shortly.
          </p>

          {hasSessionId && (
            <div
              style={{
                background: '#0D0D0F',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Session ID
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#F9F8F6', marginTop: '.35rem', wordBreak: 'break-all' }}>
                {sessionId}
              </div>
            </div>
          )}

          {loading && <p style={{ color: '#8A8A8E', fontSize: '0.82rem', marginBottom: '1rem' }}>Resolving your order...</p>}

          {resolvedOrder && (
            <div
              style={{
                background: '#0D0D0F',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px',
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#8A8A8E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '.5rem' }}>
                Matched Order
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem' }}>
                <div>
                  <div style={{ fontSize: '.72rem', color: '#8A8A8E' }}>Order #</div>
                  <div style={{ fontFamily: 'monospace', color: '#C0392B' }}>{resolvedOrder.order_number}</div>
                </div>
                <div>
                  <div style={{ fontSize: '.72rem', color: '#8A8A8E' }}>Status</div>
                  <div>{resolvedOrder.status}</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap' }}>
            <Link href="/dashboard" className="btn-p" style={{ textDecoration: 'none', borderRadius: '3px', padding: '.8rem 1.2rem' }}>
              Go to Dashboard
            </Link>
            <Link href="/" className="btn-g" style={{ textDecoration: 'none', borderRadius: '3px', padding: '.8rem 1.2rem' }}>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
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
      <SuccessContent />
    </Suspense>
  );
}

