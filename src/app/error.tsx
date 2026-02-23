'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        margin: 0,
        display: 'grid',
        placeItems: 'center',
        background: '#0D0D0F',
        color: '#F9F8F6',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <button
          onClick={reset}
          style={{
            marginTop: '1rem',
            background: '#C0392B',
            color: '#F9F8F6',
            border: 'none',
            padding: '0.7rem 1rem',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
