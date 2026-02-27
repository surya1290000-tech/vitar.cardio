'use client';

import { useEffect, useState } from 'react';

type ThemeMode = 'dark' | 'light';
type Placement = 'fixed' | 'inline';

function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('vitar-theme', mode);
}

interface ThemeToggleProps {
  placement?: Placement;
}

export default function ThemeToggle({ placement = 'fixed' }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('vitar-theme');
    const preferred =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    const initial = (saved === 'light' || saved === 'dark' ? saved : preferred) as ThemeMode;
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  if (!mounted) return null;

  return (
    <button
      type="button"
      className={`theme-toggle ${placement === 'inline' ? 'inline' : ''}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <span className={`theme-track ${theme === 'light' ? 'on' : ''}`}>
        <span className="theme-icon left">D</span>
        <span className="theme-icon right">L</span>
        <span className="theme-thumb" />
      </span>
    </button>
  );
}
