'use client';

import { ReactNode } from 'react';
import { usePermissions } from '../../contexts/PermissionContext';
import { Permission, UserRole } from '../../business-types/roles';

interface RoleGuardProps {
  children: ReactNode;
  permissions?: Permission[];
  roles?: UserRole[];
  locationId?: string;
  requireAll?: boolean; // If true, user must have ALL permissions/roles, otherwise ANY
  fallback?: ReactNode;
  hideOnNoAccess?: boolean; // If true, returns null instead of fallback
}

export function RoleGuard({
  children,
  permissions = [],
  roles = [],
  locationId,
  requireAll = false,
  fallback = <div className="text-gray-500 text-sm">Du har inte behörighet att se detta innehåll.</div>,
  hideOnNoAccess = false
}: RoleGuardProps) {
  const { user, hasPermission, canAccessLocation, isLoading } = usePermissions();

  // Show loading state
  if (isLoading) {
    return (
      <div className="animate-pulse bg-gray-200 rounded h-8"></div>
    );
  }

  // No user logged in
  if (!user) {
    return hideOnNoAccess ? null : fallback;
  }

  // Check role requirements
  if (roles.length > 0) {
    const hasRequiredRole = requireAll
      ? roles.every(role => user.role === role)
      : roles.some(role => user.role === role);
    
    if (!hasRequiredRole) {
      return hideOnNoAccess ? null : fallback;
    }
  }

  // Check permission requirements
  if (permissions.length > 0) {
    const hasRequiredPermissions = requireAll
      ? permissions.every(permission => hasPermission(permission))
      : permissions.some(permission => hasPermission(permission));
    
    if (!hasRequiredPermissions) {
      return hideOnNoAccess ? null : fallback;
    }
  }

  // Check location access if specified
  if (locationId && !canAccessLocation(locationId)) {
    return hideOnNoAccess ? null : fallback;
  }

  // User has required permissions
  return <>{children}</>;
}

// Convenience components for common use cases
export function AdminOnly({ children, fallback, hideOnNoAccess = false }: { 
  children: ReactNode; 
  fallback?: ReactNode;
  hideOnNoAccess?: boolean;
}) {
  return (
    <RoleGuard 
      roles={[UserRole.SUPER_ADMIN]} 
      fallback={fallback}
      hideOnNoAccess={hideOnNoAccess}
    >
      {children}
    </RoleGuard>
  );
}

export function HQOnly({ children, fallback, hideOnNoAccess = false }: { 
  children: ReactNode; 
  fallback?: ReactNode;
  hideOnNoAccess?: boolean;
}) {
  return (
    <RoleGuard 
      roles={[UserRole.SUPER_ADMIN, UserRole.HQ_MANAGER]} 
      fallback={fallback}
      hideOnNoAccess={hideOnNoAccess}
    >
      {children}
    </RoleGuard>
  );
}

export function StoreManagerOrAbove({ children, fallback, hideOnNoAccess = false }: { 
  children: ReactNode; 
  fallback?: ReactNode;
  hideOnNoAccess?: boolean;
}) {
  return (
    <RoleGuard 
      roles={[UserRole.SUPER_ADMIN, UserRole.HQ_MANAGER, UserRole.STORE_MANAGER]} 
      fallback={fallback}
      hideOnNoAccess={hideOnNoAccess}
    >
      {children}
    </RoleGuard>
  );
}

// Permission-based guards
export function CanManageLocations({ children, fallback, hideOnNoAccess = false }: { 
  children: ReactNode; 
  fallback?: ReactNode;
  hideOnNoAccess?: boolean;
}) {
  return (
    <RoleGuard 
      permissions={[Permission.MANAGE_ALL_LOCATIONS, Permission.MANAGE_ASSIGNED_LOCATIONS]} 
      fallback={fallback}
      hideOnNoAccess={hideOnNoAccess}
    >
      {children}
    </RoleGuard>
  );
}

export function CanManageUsers({ children, fallback, hideOnNoAccess = false }: { 
  children: ReactNode; 
  fallback?: ReactNode;
  hideOnNoAccess?: boolean;
}) {
  return (
    <RoleGuard 
      permissions={[Permission.MANAGE_ALL_USERS, Permission.MANAGE_LOCATION_USERS]} 
      fallback={fallback}
      hideOnNoAccess={hideOnNoAccess}
    >
      {children}
    </RoleGuard>
  );
}

export function CanViewAnalytics({ children, fallback, hideOnNoAccess = false }: { 
  children: ReactNode; 
  fallback?: ReactNode;
  hideOnNoAccess?: boolean;
}) {
  return (
    <RoleGuard 
      permissions={[Permission.VIEW_ALL_ANALYTICS, Permission.VIEW_LOCATION_ANALYTICS]} 
      fallback={fallback}
      hideOnNoAccess={hideOnNoAccess}
    >
      {children}
    </RoleGuard>
  );
}

export function LocationGuard({ 
  locationId, 
  children, 
  fallback, 
  hideOnNoAccess = false 
}: { 
  locationId: string;
  children: ReactNode; 
  fallback?: ReactNode;
  hideOnNoAccess?: boolean;
}) {
  return (
    <RoleGuard 
      locationId={locationId}
      fallback={fallback}
      hideOnNoAccess={hideOnNoAccess}
    >
      {children}
    </RoleGuard>
  );
}