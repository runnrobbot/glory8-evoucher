import { create } from 'zustand';
import { PERMISSIONS } from '@/utils/constants';

/**
 * Auth store — single source of truth for authentication state.
 *
 * Key design decisions:
 * - `isLoading` stays TRUE until BOTH auth state AND Firestore profile are resolved.
 *   This prevents the race condition where isAuthenticated=true but userProfile=null.
 * - `setAuthResolved` is an atomic action that updates both user + profile in one
 *   render cycle, eliminating the intermediate "no profile" state.
 * - `isBootstrapped` is null (unknown) → false (needs setup) → true (ready).
 */
const useAuthStore = create((set, get) => ({
  user: null,
  userProfile: null,
  isAuthenticated: false,

  // True while waiting for Firebase Auth state + Firestore profile to both resolve.
  isLoading: true,

  // null = checking, false = /setup needed, true = system initialized
  isBootstrapped: null,

  // ── Atomic update: resolves BOTH auth state and profile in one commit ──
  // This prevents the race condition where isAuthenticated=true but userProfile=null.
  setAuthResolved: ({ user, userProfile }) =>
    set({
      user,
      userProfile,
      isAuthenticated: !!user,
      isLoading: false,
    }),

  // ── Used only when profile update needs to happen separately (e.g. refresh) ──
  setUserProfile: (profile) => set({ userProfile: profile }),

  // ── Bootstrap status ──
  setIsBootstrapped: (value) => set({ isBootstrapped: value }),

  // ── Loading override (e.g. initial mount before auth fires) ──
  setLoading: (isLoading) => set({ isLoading }),

  // ── Permission check ──
  hasPermission: (permission) => {
    const { userProfile } = get();
    if (!userProfile?.role) return false;
    return (PERMISSIONS[userProfile.role] ?? []).includes(permission);
  },

  // ── Logout: reset everything atomically ──
  logout: () =>
    set({
      user: null,
      userProfile: null,
      isAuthenticated: false,
      isLoading: false,
    }),
}));

export default useAuthStore;
