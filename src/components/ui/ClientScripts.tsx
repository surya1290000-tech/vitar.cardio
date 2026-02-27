'use client';
import { useEffect } from 'react';

export default function ClientScripts() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

    // Progressive enhancement: animate common layout cards without editing each section markup.
    document
      .querySelectorAll<HTMLElement>('.sen-c,.step,.p-card,.m-card,.t-card,.st-it,.af-item')
      .forEach((el, index) => {
        el.classList.add('animate-in');
        el.style.setProperty('--enter-delay', `${Math.min((index % 6) * 70, 280)}ms`);
        obs.observe(el);
      });

    const nav = document.getElementById('nav');
    const navProgress = document.getElementById('navProgress');
    const heroSection = document.querySelector<HTMLElement>('.hero');
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      if (!nav) return;
      const currentScrollY = window.scrollY;
      const scrollingDown = currentScrollY > lastScrollY + 2;
      const shouldHideNav = scrollingDown && currentScrollY > 140;

      nav.classList.toggle('is-scrolled', currentScrollY > 50);
      nav.classList.toggle('is-hidden', shouldHideNav);

      if (navProgress) {
        const doc = document.documentElement;
        const maxScroll = Math.max(doc.scrollHeight - doc.clientHeight, 1);
        const progress = Math.min(currentScrollY / maxScroll, 1);
        navProgress.style.transform = `scaleX(${progress})`;
      }
      if (!prefersReducedMotion && heroSection) {
        const rect = heroSection.getBoundingClientRect();
        const depth = Math.min(Math.max(-rect.top, 0), 420);
        document.documentElement.style.setProperty('--hero-parallax-bg', `${depth * 0.14}px`);
        document.documentElement.style.setProperty('--hero-parallax-grid', `${depth * 0.08}px`);
      }

      lastScrollY = currentScrollY;
    };
    onScroll();
    window.addEventListener('scroll', onScroll);

    const tiltCleanup: Array<() => void> = [];
    if (!prefersReducedMotion && window.innerWidth > 900) {
      document.querySelectorAll<HTMLElement>('.sen-c,.p-card,.t-card,.m-card,.st-it').forEach((card) => {
        card.classList.add('interactive-tilt');

        const onCardMove = (event: MouseEvent) => {
          const rect = card.getBoundingClientRect();
          const px = (event.clientX - rect.left) / rect.width;
          const py = (event.clientY - rect.top) / rect.height;
          const tiltY = (px - 0.5) * 6;
          const tiltX = (0.5 - py) * 5;
          card.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
          card.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
          card.style.setProperty('--pointer-x', `${(px * 100).toFixed(2)}%`);
          card.style.setProperty('--pointer-y', `${(py * 100).toFixed(2)}%`);
        };

        const onCardLeave = () => {
          card.style.setProperty('--tilt-x', '0deg');
          card.style.setProperty('--tilt-y', '0deg');
          card.style.setProperty('--pointer-x', '50%');
          card.style.setProperty('--pointer-y', '50%');
        };

        card.addEventListener('mousemove', onCardMove);
        card.addEventListener('mouseleave', onCardLeave);
        tiltCleanup.push(() => {
          card.removeEventListener('mousemove', onCardMove);
          card.removeEventListener('mouseleave', onCardLeave);
          card.classList.remove('interactive-tilt');
        });
      });
    }

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
      tiltCleanup.forEach((cleanup) => cleanup());
    };
  }, []);

  return null;
}
