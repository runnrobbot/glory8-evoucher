import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import useAuthStore from '@/store/authStore';
import ProtectedRoute from '@/components/ProtectedRoute';
import AuthLayout from '@/layouts/AuthLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// Lazy load all pages
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const BootstrapPage = lazy(() => import('@/features/auth/BootstrapPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const UsersPage = lazy(() => import('@/features/users/UsersPage'));
const DivisionsPage = lazy(() => import('@/features/divisions/DivisionsPage'));
const CampaignsPage = lazy(() => import('@/features/campaigns/CampaignsPage'));
const VouchersPage = lazy(() => import('@/features/vouchers/VouchersPage'));
const ValidationPage = lazy(() => import('@/features/validation/ValidationPage'));
const RedemptionsPage = lazy(() => import('@/features/redemption/RedemptionsPage'));
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'));
const AuditLogPage = lazy(() => import('@/features/audit/AuditLogPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const AccessDeniedPage = lazy(() => import('@/pages/AccessDeniedPage'));

const SuspenseWrapper = ({ children }) => (
  <Suspense fallback={<LoadingSpinner fullPage />}>
    {children}
  </Suspense>
);

/**
 * Guard for the /setup route.
 * Blocks access once the system is initialized.
 */
function SetupGuard({ children }) {
  const { isBootstrapped } = useAuthStore();

  if (isBootstrapped === null) {
    return <LoadingSpinner fullPage text="Checking system status..." />;
  }

  if (isBootstrapped) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

/**
 * Guard for public auth routes (/login, /forgot-password).
 *
 * Redirect matrix:
 *   still loading            → spinner (prevents premature redirect)
 *   not bootstrapped         → /setup
 *   authenticated + profile  → / (dashboard)
 *   authenticated, no profile→ stay on login (profile failed to load; user
 *                               should re-enter credentials or wait)
 *   not authenticated        → render children (the login form)
 *
 * CRITICAL: We check `userProfile` in addition to `isAuthenticated` to prevent
 * the infinite redirect loop:
 *   AuthGuard (isAuthenticated=true) → <Navigate to="/" />
 *   ProtectedRoute (userProfile=null) → <Navigate to="/login" />
 *   → AuthGuard again → infinite loop / "Maximum update depth exceeded"
 */
function AuthGuard({ children }) {
  const { isAuthenticated, isLoading, isBootstrapped, userProfile } = useAuthStore();

  // Wait for Firebase auth + Firestore profile fetch + bootstrap check to all resolve
  if (isLoading || isBootstrapped === null) {
    return <LoadingSpinner fullPage text="Loading..." />;
  }

  // System not initialized — go to setup first
  if (!isBootstrapped) {
    return <Navigate to="/setup" replace />;
  }

  // Only redirect to dashboard if BOTH auth state AND profile are confirmed.
  // If profile is null (Firestore error), stay on login so user can retry.
  if (isAuthenticated && userProfile) {
    return <Navigate to="/" replace />;
  }

  return children;
}


const router = createBrowserRouter([
  // Auth routes
  {
    element: (
      <SuspenseWrapper>
        <AuthLayout />
      </SuspenseWrapper>
    ),
    children: [
      {
        path: '/login',
        element: (
          <AuthGuard>
            <LoginPage />
          </AuthGuard>
        ),
      },
      {
        path: '/forgot-password',
        element: (
          <AuthGuard>
            <ForgotPasswordPage />
          </AuthGuard>
        ),
      },
      {
        path: '/setup',
        element: (
          <SetupGuard>
            <SuspenseWrapper>
              <BootstrapPage />
            </SuspenseWrapper>
          </SetupGuard>
        ),
      },
    ],
  },
  // Dashboard routes
  {
    element: (
      <ProtectedRoute>
        <SuspenseWrapper>
          <DashboardLayout />
        </SuspenseWrapper>
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/',
        element: <SuspenseWrapper><DashboardPage /></SuspenseWrapper>,
      },
      {
        path: '/users',
        element: (
          <ProtectedRoute permission="users.view">
            <SuspenseWrapper><UsersPage /></SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: '/divisions',
        element: (
          <ProtectedRoute permission="divisions.view">
            <SuspenseWrapper><DivisionsPage /></SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: '/campaigns',
        element: (
          <ProtectedRoute permission="campaigns.view">
            <SuspenseWrapper><CampaignsPage /></SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: '/vouchers',
        element: (
          <ProtectedRoute permission="vouchers.view">
            <SuspenseWrapper><VouchersPage /></SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: '/validate',
        element: (
          <ProtectedRoute permission="vouchers.validate">
            <SuspenseWrapper><ValidationPage /></SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: '/redemptions',
        element: (
          <ProtectedRoute permission="vouchers.redeem">
            <SuspenseWrapper><RedemptionsPage /></SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: '/analytics',
        element: (
          <ProtectedRoute permission="analytics.view">
            <SuspenseWrapper><AnalyticsPage /></SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: '/audit-logs',
        element: (
          <ProtectedRoute permission="audit.view">
            <SuspenseWrapper><AuditLogPage /></SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: '/notifications',
        element: (
          <ProtectedRoute permission="notifications.view">
            <SuspenseWrapper><NotificationsPage /></SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
      {
        path: '/settings',
        element: (
          <ProtectedRoute permission="settings.view">
            <SuspenseWrapper><SettingsPage /></SuspenseWrapper>
          </ProtectedRoute>
        ),
      },
    ],
  },
  // Error pages
  {
    path: '/access-denied',
    element: <SuspenseWrapper><AccessDeniedPage /></SuspenseWrapper>,
  },
  {
    path: '*',
    element: <SuspenseWrapper><NotFoundPage /></SuspenseWrapper>,
  },
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
});

function AppRouter() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}

export default AppRouter;
