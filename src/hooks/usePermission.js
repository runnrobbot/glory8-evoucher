import { useCallback } from 'react';
import useAuthStore from '@/store/authStore';

/**
 * Hook for checking user permissions.
 */
export function usePermission() {
  const { userProfile, hasPermission } = useAuthStore();

  const checkPermission = useCallback(
    (permission) => hasPermission(permission),
    [hasPermission]
  );

  const checkAnyPermission = useCallback(
    (permissions) => permissions.some((p) => hasPermission(p)),
    [hasPermission]
  );

  const checkAllPermissions = useCallback(
    (permissions) => permissions.every((p) => hasPermission(p)),
    [hasPermission]
  );

  return {
    role: userProfile?.role,
    checkPermission,
    checkAnyPermission,
    checkAllPermissions,
    isSuperAdmin: userProfile?.role === 'super_admin',
    isAdmin: userProfile?.role === 'admin',
    isStaff: userProfile?.role === 'staff',
  };
}
