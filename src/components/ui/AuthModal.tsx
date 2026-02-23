'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLogin, useSignup } from '@/hooks/useAuth';

type Tab = 'signin' | 'signup';

function closeAuthModal() {
  document.getElementById('authModal')?.classList.remove('open');
}

export default function AuthModal() {
  const [tab, setTab] = useState<Tab>('signin');
  const [signinForm, setSigninForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [localSignupError, setLocalSignupError] = useState('');

  const {
    login,
    loading: loginLoading,
    error: loginError,
    setError: setLoginError,
  } = useLogin();
  const {
    signup,
    loading: signupLoading,
    error: signupError,
    setError: setSignupError,
  } = useSignup();

  const activeError = useMemo(() => {
    if (tab === 'signin') return loginError;
    return localSignupError || signupError;
  }, [tab, loginError, localSignupError, signupError]);

  const onSigninSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await login(signinForm, { redirectTo: null });
    if (res?.success) {
      closeAuthModal();
      const postAuthAction = localStorage.getItem('vitar-post-auth-action');
      if (postAuthAction === 'openOrder') {
        localStorage.removeItem('vitar-post-auth-action');
        setTimeout(() => {
          const openOrder = (window as any).openOrder;
          if (typeof openOrder === 'function') openOrder();
        }, 120);
      }
    }
  };

  const onSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalSignupError('');

    if (signupForm.password !== signupForm.confirmPassword) {
      setLocalSignupError('Passwords do not match.');
      return;
    }

    const postAuthAction = localStorage.getItem('vitar-post-auth-action');
    const next = postAuthAction === 'openOrder' ? 'order' : undefined;

    await signup(
      {
        firstName: signupForm.firstName,
        lastName: signupForm.lastName,
        email: signupForm.email,
        password: signupForm.password,
      },
      { next }
    );
  };

  const onOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) closeAuthModal();
  };

  return (
    <div className="modal-ov" id="authModal" onClick={onOverlayClick}>
      <div className="modal">
        <button className="modal-x" onClick={closeAuthModal} type="button">
          x
        </button>

        <div className="modal-title">Welcome back.</div>
        <div className="modal-sub">Sign in to your VITAR health dashboard</div>

        <div className="tab-sw">
          <button
            className={`tab-b ${tab === 'signin' ? 'on' : ''}`}
            type="button"
            onClick={() => {
              setTab('signin');
              setLocalSignupError('');
              setSignupError(null);
            }}
          >
            Sign In
          </button>
          <button
            className={`tab-b ${tab === 'signup' ? 'on' : ''}`}
            type="button"
            onClick={() => {
              setTab('signup');
              setLoginError(null);
            }}
          >
            Create Account
          </button>
        </div>

        {activeError && (
          <div
            style={{
              background: 'rgba(192,57,43,0.1)',
              border: '1px solid rgba(192,57,43,0.3)',
              borderRadius: '4px',
              padding: '0.8rem 1rem',
              fontSize: '0.82rem',
              color: '#E74C3C',
              marginBottom: '1rem',
            }}
          >
            {activeError}
          </div>
        )}

        {tab === 'signin' ? (
          <form className="f-form" onSubmit={onSigninSubmit}>
            <div>
              <label className="f-lbl">Email Address</label>
              <input
                className="f-inp"
                type="email"
                placeholder="you@example.com"
                style={{ marginTop: '.4rem' }}
                value={signinForm.email}
                onChange={(e) => {
                  setSigninForm((s) => ({ ...s, email: e.target.value }));
                  setLoginError(null);
                }}
                required
              />
            </div>
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '.4rem',
                }}
              >
                <label className="f-lbl">Password</label>
                <Link href="/forgot-password" style={{ fontSize: '.72rem', color: '#C0392B', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>
              <input
                className="f-inp"
                type="password"
                placeholder="********"
                value={signinForm.password}
                onChange={(e) => {
                  setSigninForm((s) => ({ ...s, password: e.target.value }));
                  setLoginError(null);
                }}
                required
              />
            </div>
            <button className="btn-p" style={{ width: '100%', borderRadius: '3px', border: 'none', padding: '.9rem' }} type="submit" disabled={loginLoading}>
              {loginLoading ? 'Signing In...' : 'Sign In Securely'}
            </button>
          </form>
        ) : (
          <form className="f-form" onSubmit={onSignupSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem' }}>
              <div>
                <label className="f-lbl">First Name</label>
                <input
                  className="f-inp"
                  type="text"
                  placeholder="Jordan"
                  style={{ marginTop: '.4rem' }}
                  value={signupForm.firstName}
                  onChange={(e) => {
                    setSignupForm((s) => ({ ...s, firstName: e.target.value }));
                    setSignupError(null);
                    setLocalSignupError('');
                  }}
                  required
                />
              </div>
              <div>
                <label className="f-lbl">Last Name</label>
                <input
                  className="f-inp"
                  type="text"
                  placeholder="Smith"
                  style={{ marginTop: '.4rem' }}
                  value={signupForm.lastName}
                  onChange={(e) => {
                    setSignupForm((s) => ({ ...s, lastName: e.target.value }));
                    setSignupError(null);
                    setLocalSignupError('');
                  }}
                  required
                />
              </div>
            </div>
            <div>
              <label className="f-lbl">Email Address</label>
              <input
                className="f-inp"
                type="email"
                placeholder="you@example.com"
                style={{ marginTop: '.4rem' }}
                value={signupForm.email}
                onChange={(e) => {
                  setSignupForm((s) => ({ ...s, email: e.target.value }));
                  setSignupError(null);
                  setLocalSignupError('');
                }}
                required
              />
            </div>
            <div>
              <label className="f-lbl">Password</label>
              <input
                className="f-inp"
                type="password"
                placeholder="Min. 8 characters"
                style={{ marginTop: '.4rem' }}
                minLength={8}
                value={signupForm.password}
                onChange={(e) => {
                  setSignupForm((s) => ({ ...s, password: e.target.value }));
                  setSignupError(null);
                  setLocalSignupError('');
                }}
                required
              />
            </div>
            <div>
              <label className="f-lbl">Confirm Password</label>
              <input
                className="f-inp"
                type="password"
                placeholder="Repeat password"
                style={{ marginTop: '.4rem' }}
                value={signupForm.confirmPassword}
                onChange={(e) => {
                  setSignupForm((s) => ({ ...s, confirmPassword: e.target.value }));
                  setSignupError(null);
                  setLocalSignupError('');
                }}
                required
              />
            </div>
            <button className="btn-p" style={{ width: '100%', borderRadius: '3px', border: 'none', padding: '.9rem' }} type="submit" disabled={signupLoading}>
              {signupLoading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
