import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setUser: (user: User, token: string) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      isAuthenticated: false,

      setUser: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),

      clearUser: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),

      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'vitar-auth',
      // Only persist user info, not the token (token refreshed via cookie)
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
