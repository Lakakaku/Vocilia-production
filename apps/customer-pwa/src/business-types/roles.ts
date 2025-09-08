export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  HQ_MANAGER = 'hq_manager', 
  STORE_MANAGER = 'store_manager',
  STAFF = 'staff'
}

export enum Permission {
  // Business management
  MANAGE_BUSINESS = 'manage_business',
  VIEW_BUSINESS = 'view_business',
  
  // Location management
  MANAGE_ALL_LOCATIONS = 'manage_all_locations',
  MANAGE_ASSIGNED_LOCATIONS = 'manage_assigned_locations',
  VIEW_ALL_LOCATIONS = 'view_all_locations',
  VIEW_ASSIGNED_LOCATIONS = 'view_assigned_locations',
  
  // User management
  MANAGE_ALL_USERS = 'manage_all_users',
  MANAGE_LOCATION_USERS = 'manage_location_users',
  VIEW_ALL_USERS = 'view_all_users',
  VIEW_LOCATION_USERS = 'view_location_users',
  
  // Analytics and reports
  VIEW_ALL_ANALYTICS = 'view_all_analytics',
  VIEW_LOCATION_ANALYTICS = 'view_location_analytics',
  EXPORT_ALL_REPORTS = 'export_all_reports',
  EXPORT_LOCATION_REPORTS = 'export_location_reports',
  
  // QR codes
  MANAGE_ALL_QR_CODES = 'manage_all_qr_codes',
  MANAGE_LOCATION_QR_CODES = 'manage_location_qr_codes',
  
  // Settings
  MANAGE_BUSINESS_SETTINGS = 'manage_business_settings',
  MANAGE_LOCATION_SETTINGS = 'manage_location_settings',
  VIEW_BUSINESS_SETTINGS = 'view_business_settings'
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string;
  assignedLocationIds?: string[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface RoleDefinition {
  role: UserRole;
  name: string;
  description: string;
  permissions: Permission[];
  canAssignLocations: boolean;
}

// Role definitions with permissions
export const ROLE_DEFINITIONS: Record<UserRole, RoleDefinition> = {
  [UserRole.SUPER_ADMIN]: {
    role: UserRole.SUPER_ADMIN,
    name: 'Superadministratör',
    description: 'Full åtkomst till alla funktioner och alla företag',
    permissions: Object.values(Permission),
    canAssignLocations: true
  },
  
  [UserRole.HQ_MANAGER]: {
    role: UserRole.HQ_MANAGER,
    name: 'Huvudkontor Manager',
    description: 'Kan hantera alla platser och användare inom företaget',
    permissions: [
      Permission.MANAGE_BUSINESS,
      Permission.VIEW_BUSINESS,
      Permission.MANAGE_ALL_LOCATIONS,
      Permission.VIEW_ALL_LOCATIONS,
      Permission.MANAGE_ALL_USERS,
      Permission.VIEW_ALL_USERS,
      Permission.VIEW_ALL_ANALYTICS,
      Permission.EXPORT_ALL_REPORTS,
      Permission.MANAGE_ALL_QR_CODES,
      Permission.MANAGE_BUSINESS_SETTINGS,
      Permission.VIEW_BUSINESS_SETTINGS
    ],
    canAssignLocations: true
  },
  
  [UserRole.STORE_MANAGER]: {
    role: UserRole.STORE_MANAGER,
    name: 'Butikschef',
    description: 'Kan hantera tilldelade platser och deras användare',
    permissions: [
      Permission.VIEW_BUSINESS,
      Permission.MANAGE_ASSIGNED_LOCATIONS,
      Permission.VIEW_ASSIGNED_LOCATIONS,
      Permission.MANAGE_LOCATION_USERS,
      Permission.VIEW_LOCATION_USERS,
      Permission.VIEW_LOCATION_ANALYTICS,
      Permission.EXPORT_LOCATION_REPORTS,
      Permission.MANAGE_LOCATION_QR_CODES,
      Permission.MANAGE_LOCATION_SETTINGS
    ],
    canAssignLocations: false
  },
  
  [UserRole.STAFF]: {
    role: UserRole.STAFF,
    name: 'Personal',
    description: 'Kan visa information för tilldelade platser',
    permissions: [
      Permission.VIEW_BUSINESS,
      Permission.VIEW_ASSIGNED_LOCATIONS,
      Permission.VIEW_LOCATION_USERS,
      Permission.VIEW_LOCATION_ANALYTICS
    ],
    canAssignLocations: false
  }
};

// Helper functions for role and permission checking
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const roleDefinition = ROLE_DEFINITIONS[userRole];
  return roleDefinition.permissions.includes(permission);
}

export function hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

export function hasAllPermissions(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

export function canAccessLocation(user: User, locationId: string): boolean {
  if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.HQ_MANAGER) {
    return true;
  }
  
  return user.assignedLocationIds?.includes(locationId) || false;
}

export function getRoleDisplayName(role: UserRole): string {
  return ROLE_DEFINITIONS[role]?.name || role;
}

export function getRoleDescription(role: UserRole): string {
  return ROLE_DEFINITIONS[role]?.description || '';
}

export function getAvailableRolesForUser(currentUserRole: UserRole): UserRole[] {
  switch (currentUserRole) {
    case UserRole.SUPER_ADMIN:
      return [UserRole.HQ_MANAGER, UserRole.STORE_MANAGER, UserRole.STAFF];
    case UserRole.HQ_MANAGER:
      return [UserRole.STORE_MANAGER, UserRole.STAFF];
    case UserRole.STORE_MANAGER:
      return [UserRole.STAFF];
    default:
      return [];
  }
}