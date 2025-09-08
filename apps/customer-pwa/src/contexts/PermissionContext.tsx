'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, UserRole, Permission, hasPermission, canAccessLocation } from '../business-types/roles';

interface PermissionContextType {
  user: User | null;
  isLoading: boolean;
  hasPermission: (permission: Permission) => boolean;
  canAccessLocation: (locationId: string) => boolean;
  canManageUser: (targetUser: User) => boolean;
  isHQLevel: boolean;
  isStoreLevel: boolean;
  assignedLocationIds: string[];
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

interface PermissionProviderProps {
  children: ReactNode;
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mock user data - in real implementation, this would fetch from auth/API
    setTimeout(() => {
      setUser({
        id: 'user-1',
        email: 'admin@cafearura.se',
        name: 'Emma Larsson',
        role: UserRole.HQ_MANAGER,
        businessId: 'business-1',
        assignedLocationIds: [], // HQ Manager has access to all locations
        isActive: true,
        createdAt: '2024-01-15T10:00:00Z',
        lastLoginAt: '2024-08-24T08:30:00Z'
      });
      setIsLoading(false);
    }, 500);
  }, []);

  const checkPermission = (permission: Permission): boolean => {
    if (!user) return false;
    return hasPermission(user.role, permission);
  };

  const checkLocationAccess = (locationId: string): boolean => {
    if (!user) return false;
    return canAccessLocation(user, locationId);
  };

  const checkCanManageUser = (targetUser: User): boolean => {
    if (!user) return false;
    
    // Super admin can manage anyone
    if (user.role === UserRole.SUPER_ADMIN) return true;
    
    // HQ Manager can manage Store Managers and Staff in same business
    if (user.role === UserRole.HQ_MANAGER) {
      return targetUser.businessId === user.businessId && 
             (targetUser.role === UserRole.STORE_MANAGER || targetUser.role === UserRole.STAFF);
    }
    
    // Store Manager can manage Staff in assigned locations
    if (user.role === UserRole.STORE_MANAGER) {
      return targetUser.businessId === user.businessId &&
             targetUser.role === UserRole.STAFF &&
             targetUser.assignedLocationIds?.some(locationId => 
               user.assignedLocationIds?.includes(locationId)
             );
    }
    
    return false;
  };

  const isHQLevel = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.HQ_MANAGER;
  const isStoreLevel = user?.role === UserRole.STORE_MANAGER;
  const assignedLocationIds = user?.assignedLocationIds || [];

  const value: PermissionContextType = {
    user,
    isLoading,
    hasPermission: checkPermission,
    canAccessLocation: checkLocationAccess,
    canManageUser: checkCanManageUser,
    isHQLevel,
    isStoreLevel,
    assignedLocationIds
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions(): PermissionContextType {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}

// Convenience hooks for common permission checks
export function useCanManageLocations() {
  const { hasPermission } = usePermissions();
  return hasPermission(Permission.MANAGE_ALL_LOCATIONS) || hasPermission(Permission.MANAGE_ASSIGNED_LOCATIONS);
}

export function useCanManageUsers() {
  const { hasPermission } = usePermissions();
  return hasPermission(Permission.MANAGE_ALL_USERS) || hasPermission(Permission.MANAGE_LOCATION_USERS);
}

export function useCanViewAnalytics() {
  const { hasPermission } = usePermissions();
  return hasPermission(Permission.VIEW_ALL_ANALYTICS) || hasPermission(Permission.VIEW_LOCATION_ANALYTICS);
}

export function useCanExportReports() {
  const { hasPermission } = usePermissions();
  return hasPermission(Permission.EXPORT_ALL_REPORTS) || hasPermission(Permission.EXPORT_LOCATION_REPORTS);
}