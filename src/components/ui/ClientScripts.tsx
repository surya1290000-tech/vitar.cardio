'use client';
import { useEffect } from 'react';

export default function ClientScripts() {
  useEffect(() => {
    const preloader = document.getElementById('preloader');
    if (preloader) {
      setTimeout(() => {
        preloader.classList.add('out');
        setTimeout(() => {
          preloader.style.display = 'none';
        }, 700);
      }, 1600);
    }

    const cur = document.getElementById('cursor');
    const ring = document.getElementById('cursorRing');
    let mx = 0;
    let my = 0;
    let rx = 0;
    let ry = 0;

    const onMouseMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (cur) cur.style.transform = `translate(${mx - 5}px,${my - 5}px)`;
    };
    document.addEventListener('mousemove', onMouseMove);

    let animId: number;
    const animRing = () => {
      rx += (mx - rx) * 0.12;
      ry += (my - ry) * 0.12;
      if (ring) ring.style.transform = `translate(${rx - 18}px,${ry - 18}px)`;
      animId = requestAnimationFrame(animRing);
    };
    animRing();

    document.querySelectorAll('a,button,.sen-c,.p-card,.t-card').forEach((el) => {
      el.addEventListener('mouseenter', () => ring?.classList.add('hovered'));
      el.addEventListener('mouseleave', () => ring?.classList.remove('hovered'));
    });

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('on');
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach((el) => obs.observe(el));

    const nav = document.getElementById('nav');
    const onScroll = () => {
      if (nav) nav.style.background = window.scrollY > 50 ? 'rgba(13,13,15,.92)' : 'rgba(13,13,15,.7)';
    };
    window.addEventListener('scroll', onScroll);

    let hr = 72;
    let dir = 1;
    const hrInterval = setInterval(() => {
      hr += dir * (Math.random() < 0.7 ? 1 : 2);
      if (hr > 80) dir = -1;
      if (hr < 68) dir = 1;
      const el = document.querySelector('.hr-num');
      if (el) el.textContent = String(hr);
    }, 1200);

    const isAuthed = () => {
      try {
        const raw = localStorage.getItem('vitar-auth');
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return Boolean(parsed?.state?.isAuthenticated && parsed?.state?.user);
      } catch {
        return false;
      }
    };

    (window as any).openAuth = () => document.getElementById('authModal')?.classList.add('open');
    (window as any).closeAuth = () => document.getElementById('authModal')?.classList.remove('open');
    (window as any).openOrder = () => {
      if (!isAuthed()) {
        localStorage.setItem('vitar-post-auth-action', 'openOrder');
        document.getElementById('authModal')?.classList.add('open');
        return;
      }
      document.getElementById('orderModal')?.classList.add('open');
    };
    (window as any).closeOrder = () => document.getElementById('orderModal')?.classList.remove('open');

    // Continuation from verify flow back to homepage.
    try {
      const url = new URL(window.location.href);
      const action = url.searchParams.get('postAuthAction');
      if (action === 'openOrder' && isAuthed()) {
        document.getElementById('orderModal')?.classList.add('open');
        url.searchParams.delete('postAuthAction');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      // no-op
    }

    document.querySelectorAll('.modal-ov').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) (overlay as HTMLElement).classList.remove('open');
      });
    });

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(animId);
      clearInterval(hrInterval);
      obs.disconnect();
    };
  }, []);

  return null;
}
