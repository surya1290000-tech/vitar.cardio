'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

// ── SIGNUP ─────────────────────────────────────────────────────
export function useSignup() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const router = useRouter();

  const signup = async (
    data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      phone?: string | null;
      dateOfBirth?: string | null;
      bloodType?: string | null;
      heightCm?: number | null;
      weightKg?: number | null;
      sex?: string | null;
      medicalNotes?: string | null;
      familyHistory?: string | null;
      restingHeartRate?: number | null;
      allergies?: string[];
      medications?: string[];
      conditions?: string[];
      physicianName?: string | null;
      physicianPhone?: string | null;
    },
    options?: { next?: 'order' }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Signup failed. Please try again.');
        return null;
      }

      // Redirect to verify page with userId and optional continuation intent.
      const nextParam = options?.next ? `&next=${encodeURIComponent(options.next)}` : '';
      router.push(`/verify?userId=${json.userId}${nextParam}`);
      return json;
    } catch {
      setError('Network error. Please check your connection.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { signup, loading, error, setError };
}

// ── LOGIN ──────────────────────────────────────────────────────
export function useLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const { setUser }           = useAuthStore();
  const router = useRouter();

  const login = async (
    data: { email: string; password: string },
    options?: { redirectTo?: string | null }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include', // important: sends/receives cookies
      });

      const json = await res.json();

      if (!res.ok) {
        // Email not verified — redirect to verify page
        if (json.code === 'EMAIL_NOT_VERIFIED') {
          router.push(`/verify?userId=${json.userId}`);
          return null;
        }
        setError(json.error || 'Login failed. Please try again.');
        return null;
      }

      // Store user in global state
      setUser(json.user, json.accessToken);
      const redirectTo = options?.redirectTo === undefined ? '/dashboard' : options.redirectTo;
      if (redirectTo) {
        router.push(redirectTo);
      }
      return json;
    } catch {
      setError('Network error. Please check your connection.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (
    credential: string,
    options?: { redirectTo?: string | null }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/oauth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Google sign-in failed. Please try again.');
        return null;
      }

      setUser(json.user, json.accessToken);
      const redirectTo = options?.redirectTo === undefined ? '/dashboard' : options.redirectTo;
      if (redirectTo) {
        router.push(redirectTo);
      }
      return json;
    } catch {
      setError('Network error. Please check your connection.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { login, loginWithGoogle, loading, error, setError };
}

// ── VERIFY OTP ─────────────────────────────────────────────────
export function useVerifyOTP() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const { setUser }           = useAuthStore();
  const router = useRouter();

  const verify = async (userId: string, otp: string, next?: 'order') => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, otp }),
        credentials: 'include',
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Verification failed.');
        return null;
      }

      setUser(json.user, json.accessToken);
      if (next === 'order') {
        router.push('/?postAuthAction=openOrder');
      } else {
        router.push('/dashboard');
      }
      return json;
    } catch {
      setError('Network error. Please check your connection.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { verify, loading, error, setError };
}

// ── RESEND OTP ─────────────────────────────────────────────────
export function useResendOTP() {
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const resend = async (userId: string) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to resend code.');
        return;
      }
      setSuccess(true);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return { resend, loading, success, error };
}

// ── LOGOUT ─────────────────────────────────────────────────────
export function useLogout() {
  const { clearUser } = useAuthStore();
  const router = useRouter();

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    clearUser();
    router.push('/');
  };

  return { logout };
}

// ── FORGOT PASSWORD ────────────────────────────────────────────
export function useForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const forgotPassword = async (email: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed.');
        return;
      }
      setSuccess(true);
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return { forgotPassword, loading, success, error };
}
