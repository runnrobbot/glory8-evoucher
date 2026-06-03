import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { COLLECTIONS } from '@/utils/constants';
import useAuthStore from '@/store/authStore';

/**
 * Subscribes to Firebase Auth state and syncs with Zustand authStore.
 * Must be mounted ONCE at the app root via <AuthInitializer> in App.jsx.
 *
 * Design notes:
 *
 * 1. ATOMIC STATE UPDATE — `setAuthResolved({ user, userProfile })` commits
 *    both values in a single Zustand update, so the app never sees the
 *    intermediate state: isAuthenticated=true + userProfile=null.
 *    This prevents the ProtectedRoute "Loading profile..." infinite spinner.
 *
 * 2. SINGLE LOADING GATE — `isLoading` stays true until BOTH the auth token
 *    AND the Firestore profile fetch have completed. Route guards wait on this.
 *
 * 3. BOOTSTRAP CHECK — Runs in parallel with the auth listener.
 *    `settings/general` is publicly readable (see firestore.rules), so this
 *    works even before any user is signed in.
 *
 * 4. STRICTMODE NOTE — React StrictMode mounts effects twice in dev.
 *    We do NOT try to guard against this with a ref, because:
 *    - The cleanup unsubscribes the first listener → only 1 active at a time
 *    - Zustand's `set()` is idempotent for same values → no extra re-renders
 *    - A ref guard that resets in cleanup would break HMR and cause zero listeners
 */
export function useAuthListener() {
  const { setAuthResolved, setIsBootstrapped } = useAuthStore();

  useEffect(() => {
    // ── 1. Bootstrap check ────────────────────────────────────────────────
    // Runs immediately (no auth required) to determine if /setup is needed.
    const checkBootstrap = async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'general'));
        setIsBootstrapped(snap.exists() && snap.data().isBootstrapped === true);
      } catch (error) {
        // permission-denied → fresh DB, no settings yet → show /setup
        // other errors (network) → assume bootstrapped to not expose /setup
        setIsBootstrapped(error?.code === 'permission-denied' ? false : true);
        console.warn('[Bootstrap check]', error?.code, error?.message);
      }
    };

    checkBootstrap();

    // ── 2. Auth state listener ────────────────────────────────────────────
    // We do NOT resolve state until the Firestore profile fetch completes.
    // `isLoading` stays true throughout, so route guards show a spinner
    // instead of flashing an incorrect state.
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Signed out — atomic reset
        setAuthResolved({ user: null, userProfile: null });
        return;
      }

      // Signed in — fetch Firestore profile before resolving
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid));
        const profile = snap.exists()
          ? { uid: firebaseUser.uid, ...snap.data() }
          : null;

        setAuthResolved({ user: firebaseUser, userProfile: profile });
      } catch (error) {
        console.error('[Auth] Profile fetch failed:', error);
        // Resolve with null profile — AuthGuard will keep user on /login
        // instead of bouncing them into the app with a broken session.
        setAuthResolved({ user: firebaseUser, userProfile: null });
      }
    });

    return () => unsubscribe();
  // Zustand action references are stable and won't cause re-runs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default useAuthStore;
