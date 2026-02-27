'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/hooks/useAuth';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { Button, ButtonLink } from '@/components/ui/Button';

export default function Navbar() {
  const { user, isAuthenticated } = useAuthStore();
  const { logout } = useLogout();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const sectionIds = ['sensors', 'how', 'pricing', 'about'];

    const updateActiveSection = () => {
      if (pathname !== '/') {
        setActiveSection('');
        return;
      }

      const scrollPos = window.scrollY + 160;
      let current = '';

      sectionIds.forEach((id) => {
        const section = document.getElementById(id);
        if (section && scrollPos >= section.offsetTop) {
          current = id;
        }
      });

      setActiveSection(current);
    };

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateActiveSection);
    };
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle('nav-menu-open', menuOpen);
    return () => document.body.classList.remove('nav-menu-open');
  }, [menuOpen]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const linkState = (id: string) => (pathname === '/' && activeSection === id ? 'active' : '');
  const sectionHref = (id: string) => (pathname === '/' ? `#${id}` : `/#${id}`);

  return (
    <nav id="nav" className={`${mounted ? 'nav-mounted' : ''} ${menuOpen ? 'menu-open' : ''}`.trim()}>
      <Link href="/" className="nav-logo" onClick={() => setMenuOpen(false)}>
        VITAR<span>.</span>
      </Link>

      <ul className={`nav-links ${menuOpen ? 'open' : ''}`}>
        <li>
          <a href={sectionHref('sensors')} className={linkState('sensors')} onClick={() => { setActiveSection('sensors'); setMenuOpen(false); }}>Device</a>
        </li>
        <li>
          <a href={sectionHref('how')} className={linkState('how')} onClick={() => { setActiveSection('how'); setMenuOpen(false); }}>How It Works</a>
        </li>
        <li>
          <a href={sectionHref('pricing')} className={linkState('pricing')} onClick={() => { setActiveSection('pricing'); setMenuOpen(false); }}>Plans</a>
        </li>
        <li>
          <a href={sectionHref('about')} className={linkState('about')} onClick={() => { setActiveSection('about'); setMenuOpen(false); }}>Mission</a>
        </li>
        {isAuthenticated && (
          <li>
            <Link href="/dashboard" className={pathname.startsWith('/dashboard') ? 'active' : ''} onClick={() => setMenuOpen(false)} aria-current={pathname.startsWith('/dashboard') ? 'page' : undefined}>Dashboard</Link>
          </li>
        )}
      </ul>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {isAuthenticated ? (
          <>
            <span className="nav-user">
              {user?.firstName}
            </span>
            <ButtonLink href="/dashboard" variant="neon" size="sm" className="neon-cta-nav">
              Dashboard
            </ButtonLink>
            <Button type="button" variant="ghost" size="sm" onClick={logout}>
              Sign Out
            </Button>
          </>
        ) : (
          <>
            <ButtonLink href="/login" variant="primary" size="sm">
              Sign In
            </ButtonLink>
            <ButtonLink href="/signup" variant="neon" size="sm" className="neon-cta-nav">
              Get Started
            </ButtonLink>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <ThemeToggle placement="inline" />
        </div>

        <button
          className="ham"
          type="button"
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className="nav-progress" aria-hidden="true">
        <span id="navProgress" className="nav-progress-fill" />
      </div>
    </nav>
  );
}
