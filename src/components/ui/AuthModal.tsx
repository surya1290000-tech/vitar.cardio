'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLogin, useSignup } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';

type Tab = 'signin' | 'signup';
type SigninForm = { email: string; password: string };
type SignupForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateSignin = (form: SigninForm) => {
  const errors: Partial<Record<keyof SigninForm, string>> = {};
  if (!form.email.trim()) errors.email = 'Email is required.';
  else if (!emailPattern.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (!form.password) errors.password = 'Password is required.';
  return errors;
};

const validateSignup = (form: SignupForm) => {
  const errors: Partial<Record<keyof SignupForm, string>> = {};
  if (!form.firstName.trim()) errors.firstName = 'First name is required.';
  if (!form.lastName.trim()) errors.lastName = 'Last name is required.';
  if (!form.email.trim()) errors.email = 'Email is required.';
  else if (!emailPattern.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (!form.password) errors.password = 'Password is required.';
  else if (form.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (!form.confirmPassword) errors.confirmPassword = 'Please confirm your password.';
  else if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
};

function closeAuthModal() {
  document.getElementById('authModal')?.classList.remove('open');
}

export default function AuthModal() {
  const [tab, setTab] = useState<Tab>('signin');
  const [signinForm, setSigninForm] = useState({ email: '', password: '' });
  const [signinErrors, setSigninErrors] = useState<Partial<Record<keyof SigninForm, string>>>({});
  const [signinTouched, setSigninTouched] = useState<Record<keyof SigninForm, boolean>>({
    email: false,
    password: false,
  });
  const [signupForm, setSignupForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [signupErrors, setSignupErrors] = useState<Partial<Record<keyof SignupForm, string>>>({});
  const [signupTouched, setSignupTouched] = useState<Record<keyof SignupForm, boolean>>({
    firstName: false,
    lastName: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [localSignupError, setLocalSignupError] = useState('');

  const {
    login,
    loginWithGoogle,
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
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    if (!document.getElementById('google-identity-script')) {
      const script = document.createElement('script');
      script.id = 'google-identity-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  const activeError = useMemo(() => {
    if (tab === 'signin') return loginError;
    return localSignupError || signupError;
  }, [tab, loginError, localSignupError, signupError]);

  const onSigninSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateSignin(signinForm);
    setSigninErrors(validation);
    setSigninTouched({ email: true, password: true });
    if (Object.keys(validation).length > 0) return;

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
    const validation = validateSignup(signupForm);
    setSignupErrors(validation);
    setSignupTouched({
      firstName: true,
      lastName: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    if (Object.keys(validation).length > 0) return;

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

  const resolveInputStyle = ({
    touched,
    hasError,
    hasValue,
  }: {
    touched: boolean;
    hasError: boolean;
    hasValue: boolean;
  }): React.CSSProperties => ({
    border: touched
      ? hasError
        ? '1px solid rgba(231,76,60,0.55)'
        : hasValue
        ? '1px solid rgba(46,204,113,0.55)'
        : undefined
      : undefined,
    boxShadow: touched
      ? hasError
        ? '0 0 0 2px rgba(231,76,60,0.15)'
        : hasValue
        ? '0 0 0 2px rgba(46,204,113,0.12)'
        : undefined
      : undefined,
  });

  const handleGoogleSignIn = async () => {
    const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!googleClientId) {
      setLoginError('Google sign-in is not configured yet.');
      return;
    }

    const w = window as any;
    if (!w.google?.accounts?.id) {
      setLoginError('Google sign-in script is still loading. Try again.');
      return;
    }

    setOauthLoading(true);
    setLoginError(null);

    w.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response: any) => {
        const res = await loginWithGoogle(response?.credential, { redirectTo: null });
        setOauthLoading(false);
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
      },
    });

    w.google.accounts.id.prompt();
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
                value={signinForm.email}
                onBlur={() => {
                  setSigninTouched((prev) => ({ ...prev, email: true }));
                  setSigninErrors(validateSignin(signinForm));
                }}
                onChange={(e) => {
                  setSigninForm((s) => {
                    const next = { ...s, email: e.target.value };
                    setSigninErrors(validateSignin(next));
                    return next;
                  });
                  setLoginError(null);
                }}
                style={{
                  marginTop: '.4rem',
                  ...resolveInputStyle({
                    touched: signinTouched.email,
                    hasError: Boolean(signinErrors.email),
                    hasValue: signinForm.email.trim().length > 0,
                  }),
                }}
                required
              />
              {signinTouched.email && signinErrors.email && <div style={fieldErrorStyle}>{signinErrors.email}</div>}
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
                onBlur={() => {
                  setSigninTouched((prev) => ({ ...prev, password: true }));
                  setSigninErrors(validateSignin(signinForm));
                }}
                onChange={(e) => {
                  setSigninForm((s) => {
                    const next = { ...s, password: e.target.value };
                    setSigninErrors(validateSignin(next));
                    return next;
                  });
                  setLoginError(null);
                }}
                style={{
                  ...resolveInputStyle({
                    touched: signinTouched.password,
                    hasError: Boolean(signinErrors.password),
                    hasValue: signinForm.password.length > 0,
                  }),
                }}
                required
              />
              {signinTouched.password && signinErrors.password && <div style={fieldErrorStyle}>{signinErrors.password}</div>}
            </div>
            <Button variant="primary" size="md" style={{ width: '100%', borderRadius: '3px', border: 'none' }} type="submit" disabled={loginLoading}>
              {loginLoading ? 'Signing In...' : 'Sign In Securely'}
            </Button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#8A8A8E', fontSize: '0.75rem' }}>
              <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              or continue with
              <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <div style={{ display: 'flex', gap: '0.7rem' }}>
              <button type="button" className="oauth-b" onClick={() => setLoginError('Apple sign-in is coming soon.')}>
                Apple
              </button>
              <button type="button" className="oauth-b" onClick={handleGoogleSignIn} disabled={oauthLoading}>
                {oauthLoading ? 'Google...' : 'Google'}
              </button>
            </div>
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
                  value={signupForm.firstName}
                  onBlur={() => {
                    setSignupTouched((prev) => ({ ...prev, firstName: true }));
                    setSignupErrors(validateSignup(signupForm));
                  }}
                  onChange={(e) => {
                    setSignupForm((s) => {
                      const next = { ...s, firstName: e.target.value };
                      setSignupErrors(validateSignup(next));
                      return next;
                    });
                    setSignupError(null);
                    setLocalSignupError('');
                  }}
                  style={{
                    marginTop: '.4rem',
                    ...resolveInputStyle({
                      touched: signupTouched.firstName,
                      hasError: Boolean(signupErrors.firstName),
                      hasValue: signupForm.firstName.trim().length > 0,
                    }),
                  }}
                  required
                />
                {signupTouched.firstName && signupErrors.firstName && <div style={fieldErrorStyle}>{signupErrors.firstName}</div>}
              </div>
              <div>
                <label className="f-lbl">Last Name</label>
                <input
                  className="f-inp"
                  type="text"
                  placeholder="Smith"
                  value={signupForm.lastName}
                  onBlur={() => {
                    setSignupTouched((prev) => ({ ...prev, lastName: true }));
                    setSignupErrors(validateSignup(signupForm));
                  }}
                  onChange={(e) => {
                    setSignupForm((s) => {
                      const next = { ...s, lastName: e.target.value };
                      setSignupErrors(validateSignup(next));
                      return next;
                    });
                    setSignupError(null);
                    setLocalSignupError('');
                  }}
                  style={{
                    marginTop: '.4rem',
                    ...resolveInputStyle({
                      touched: signupTouched.lastName,
                      hasError: Boolean(signupErrors.lastName),
                      hasValue: signupForm.lastName.trim().length > 0,
                    }),
                  }}
                  required
                />
                {signupTouched.lastName && signupErrors.lastName && <div style={fieldErrorStyle}>{signupErrors.lastName}</div>}
              </div>
            </div>
            <div>
              <label className="f-lbl">Email Address</label>
              <input
                className="f-inp"
                type="email"
                placeholder="you@example.com"
                value={signupForm.email}
                onBlur={() => {
                  setSignupTouched((prev) => ({ ...prev, email: true }));
                  setSignupErrors(validateSignup(signupForm));
                }}
                onChange={(e) => {
                  setSignupForm((s) => {
                    const next = { ...s, email: e.target.value };
                    setSignupErrors(validateSignup(next));
                    return next;
                  });
                  setSignupError(null);
                  setLocalSignupError('');
                }}
                style={{
                  marginTop: '.4rem',
                  ...resolveInputStyle({
                    touched: signupTouched.email,
                    hasError: Boolean(signupErrors.email),
                    hasValue: signupForm.email.trim().length > 0,
                  }),
                }}
                required
              />
              {signupTouched.email && signupErrors.email && <div style={fieldErrorStyle}>{signupErrors.email}</div>}
            </div>
            <div>
              <label className="f-lbl">Password</label>
              <input
                className="f-inp"
                type="password"
                placeholder="Min. 8 characters"
                minLength={8}
                value={signupForm.password}
                onBlur={() => {
                  setSignupTouched((prev) => ({ ...prev, password: true }));
                  setSignupErrors(validateSignup(signupForm));
                }}
                onChange={(e) => {
                  setSignupForm((s) => {
                    const next = { ...s, password: e.target.value };
                    setSignupErrors(validateSignup(next));
                    return next;
                  });
                  setSignupError(null);
                  setLocalSignupError('');
                }}
                style={{
                  marginTop: '.4rem',
                  ...resolveInputStyle({
                    touched: signupTouched.password,
                    hasError: Boolean(signupErrors.password),
                    hasValue: signupForm.password.length > 0,
                  }),
                }}
                required
              />
              {signupTouched.password && signupErrors.password && <div style={fieldErrorStyle}>{signupErrors.password}</div>}
            </div>
            <div>
              <label className="f-lbl">Confirm Password</label>
              <input
                className="f-inp"
                type="password"
                placeholder="Repeat password"
                value={signupForm.confirmPassword}
                onBlur={() => {
                  setSignupTouched((prev) => ({ ...prev, confirmPassword: true }));
                  setSignupErrors(validateSignup(signupForm));
                }}
                onChange={(e) => {
                  setSignupForm((s) => {
                    const next = { ...s, confirmPassword: e.target.value };
                    setSignupErrors(validateSignup(next));
                    return next;
                  });
                  setSignupError(null);
                  setLocalSignupError('');
                }}
                style={{
                  marginTop: '.4rem',
                  ...resolveInputStyle({
                    touched: signupTouched.confirmPassword,
                    hasError: Boolean(signupErrors.confirmPassword),
                    hasValue: signupForm.confirmPassword.length > 0,
                  }),
                }}
                required
              />
              {signupTouched.confirmPassword && signupErrors.confirmPassword && <div style={fieldErrorStyle}>{signupErrors.confirmPassword}</div>}
            </div>
            <Button variant="primary" size="md" style={{ width: '100%', borderRadius: '3px', border: 'none' }} type="submit" disabled={signupLoading}>
              {signupLoading ? 'Creating...' : 'Create Account'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

const fieldErrorStyle: React.CSSProperties = {
  marginTop: '0.45rem',
  color: '#E74C3C',
  fontSize: '0.74rem',
  lineHeight: 1.4,
};
