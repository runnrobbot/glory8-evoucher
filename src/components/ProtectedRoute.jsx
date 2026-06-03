import { Navigate } from 'react-router-dom';
import useAuthStore from '@/store/authStore';
import { PERMISSIONS } from '@/utils/constants';

/**
 * Route guard that enforces authentication and optional permission checks.
 *
 * States handled:
 * - isLoading=true          → show spinner (auth + profile fetch in progress)
 * - !isAuthenticated        → redirect to /login
 * - userProfile=null        → profile failed to load; redirect to /login to re-auth
 * - role/permission denied  → redirect to /access-denied
 * - all clear               → render children
 *
 * NOTE: Thanks to the `setAuthResolved` atomic update in authStore, the window
 * where isAuthenticated=true AND userProfile=null is now extremely brief and
 * only occurs when a Firestore profile read fails — in which case we redirect
 * to /login rather than spinning forever.
 */
function ProtectedRoute({ children, permission, roles }) {
  const { isAuthenticated, isLoading, userProfile } = useAuthStore();

  // Auth + profile fetch in progress
  if (isLoading) {
    return <FullPageSpinner text="Loading..." />;
  }

  // Not authenticated → go to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but profile is null → Firestore read failed.
  // Don't spin forever — redirect to login so user can re-authenticate.
  if (!userProfile) {
    return <Navigate to="/login" replace />;
  }

  // Role-based access control
  if (roles?.length > 0 && !roles.includes(userProfile.role)) {
    return <Navigate to="/access-denied" replace />;
  }

  // Permission-based access control
  if (permission) {
    const allowed = (PERMISSIONS[userProfile.role] ?? []).includes(permission);
    if (!allowed) return <Navigate to="/access-denied" replace />;
  }

  return children;
}

function FullPageSpinner({ text = 'Loading...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm font-medium">{text}</p>
      </div>
    </div>
  );
}

export default ProtectedRoute;
