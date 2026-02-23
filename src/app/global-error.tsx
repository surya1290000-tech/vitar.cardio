'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(error);

  return (
    <html lang="en">
      <body
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
          <h1>Application error</h1>
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
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}

