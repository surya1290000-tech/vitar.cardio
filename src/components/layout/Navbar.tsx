'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';

export default function Navbar() {
  const { user, isAuthenticated } = useAuthStore();
  const { logout } = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav id="nav">
      <Link href="/" className="nav-logo">
        VITAR<span>.</span>
      </Link>

      <ul
        className="nav-links"
        style={{
          display: menuOpen ? 'flex' : undefined,
          position: menuOpen ? 'absolute' : undefined,
          top: menuOpen ? '72px' : undefined,
          left: menuOpen ? '5%' : undefined,
          right: menuOpen ? '5%' : undefined,
          background: menuOpen ? 'var(--surface-strong)' : undefined,
          border: menuOpen ? '1px solid var(--border)' : undefined,
          padding: menuOpen ? '1rem' : undefined,
          flexDirection: menuOpen ? 'column' : undefined,
          gap: menuOpen ? '1rem' : undefined,
          zIndex: menuOpen ? 600 : undefined,
        }}
      >
        <li>
          <a href="#sensors">Device</a>
        </li>
        <li>
          <a href="#how">How It Works</a>
        </li>
        <li>
          <a href="#pricing">Plans</a>
        </li>
        <li>
          <a href="#about">Mission</a>
        </li>
        {isAuthenticated && (
          <li>
            <Link href="/dashboard">Dashboard</Link>
          </li>
        )}
      </ul>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {isAuthenticated ? (
          <>
            <span style={{ color: '#8A8A8E', fontSize: '.78rem' }}>
              {user?.firstName}
            </span>
            <Link href="/dashboard" className="nav-cta" style={{ textDecoration: 'none' }}>
              Dashboard
            </Link>
            <button
              type="button"
              className="btn-g"
              style={{ textDecoration: 'none', padding: '.6rem 1.1rem', fontSize: '.78rem' }}
              onClick={logout}
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="nav-cta" style={{ textDecoration: 'none' }}>
              Sign In
            </Link>
            <Link href="/signup" className="btn-p" style={{ textDecoration: 'none', padding: '.6rem 1.5rem', fontSize: '.82rem' }}>
              Get Started
            </Link>
          </>
        )}

        <button className="ham" type="button" onClick={() => setMenuOpen((v) => !v)}>
          <span />
          <span />
          <span />
        </button>
      </div>
    </nav>
  );
}
