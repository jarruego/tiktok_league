import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Permission, 
  UserRole, 
  hasPermission, 
  hasAllPermissions, 
  hasAnyPermission,
  isAdmin,
  isModerator,
  canAdministrate,
  getRoleLevel,
  ROLE_INFO
} from '../types/permissions';

export interface UsePermissionsReturn {
  // Estado de autenticación
  isAuthenticated: boolean;
  user: { id: number; username: string; role: string } | null;
  userRole: string | null;
  
  // Verificaciones de permisos
  hasPermission: (permission: Permission) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  
  // Verificaciones de roles
  isAdmin: boolean;
  isModerator: boolean;
  canAdministrate: boolean;
  
  // Información del rol
  roleInfo: { name: string; description: string; color: string } | null;
  roleLevel: number;
  
  // Funciones de utilidad
  canAccess: (requiredPermission: Permission) => boolean;
  canAccessAny: (requiredPermissions: Permission[]) => boolean;
  canAccessAll: (requiredPermissions: Permission[]) => boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const authState = useAuth();
  
  const computedValues = useMemo(() => {
    const userRole = authState.user?.role || null;
    
    return {
      // Verificaciones de permisos
      hasPermissionFn: (permission: Permission) => hasPermission(userRole || '', permission),
      hasAllPermissionsFn: (permissions: Permission[]) => hasAllPermissions(userRole || '', permissions),
      hasAnyPermissionFn: (permissions: Permission[]) => hasAnyPermission(userRole || '', permissions),
      
      // Verificaciones de roles
      isAdmin: isAdmin(userRole || ''),
      isModerator: isModerator(userRole || ''),
      canAdministrate: canAdministrate(userRole || ''),
      
      // Información del rol
      roleInfo: userRole ? ROLE_INFO[userRole as UserRole] || null : null,
      roleLevel: getRoleLevel(userRole || ''),
    };
  }, [authState.user?.role]);

  return {
    // Estado de autenticación
    isAuthenticated: authState.isAuthenticated,
    user: authState.user,
    userRole: authState.user?.role || null,
    
    // Verificaciones de permisos
    hasPermission: computedValues.hasPermissionFn,
    hasAllPermissions: computedValues.hasAllPermissionsFn,
    hasAnyPermission: computedValues.hasAnyPermissionFn,
    
    // Verificaciones de roles
    isAdmin: computedValues.isAdmin,
    isModerator: computedValues.isModerator,
    canAdministrate: computedValues.canAdministrate,
    
    // Información del rol
    roleInfo: computedValues.roleInfo,
    roleLevel: computedValues.roleLevel,
    
    // Funciones de utilidad (alias para mejor legibilidad)
    canAccess: computedValues.hasPermissionFn,
    canAccessAny: computedValues.hasAnyPermissionFn,
    canAccessAll: computedValues.hasAllPermissionsFn,
  };
}
