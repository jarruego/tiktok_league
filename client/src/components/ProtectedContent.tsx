import React from 'react';
import { Alert, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { usePermissions } from '../hooks/usePermissions';
import { Permission, UserRole } from '../types/permissions';

const { Text } = Typography;

interface ProtectedContentProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
  requiredPermissions?: Permission[];
  requiredRole?: UserRole;
  requireAll?: boolean; // Si es true, requiere TODOS los permisos. Si es false, requiere AL MENOS UNO
  fallback?: React.ReactNode;
  showDeniedMessage?: boolean;
  customDeniedMessage?: string;
}

export const ProtectedContent: React.FC<ProtectedContentProps> = ({
  children,
  requiredPermission,
  requiredPermissions = [],
  requiredRole,
  requireAll = true,
  fallback = null,
  showDeniedMessage = false,
  customDeniedMessage
}) => {
  const permissions = usePermissions();

  // Verificar si el usuario tiene acceso
  const hasAccess = React.useMemo(() => {
    // Si no está autenticado, no tiene acceso
    if (!permissions.isAuthenticated) {
      return false;
    }

    // Verificar rol específico
    if (requiredRole && permissions.userRole !== requiredRole) {
      return false;
    }

    // Verificar permiso único
    if (requiredPermission && !permissions.hasPermission(requiredPermission)) {
      return false;
    }

    // Verificar múltiples permisos
    if (requiredPermissions.length > 0) {
      if (requireAll) {
        return permissions.hasAllPermissions(requiredPermissions);
      } else {
        return permissions.hasAnyPermission(requiredPermissions);
      }
    }

    return true;
  }, [
    permissions.isAuthenticated,
    permissions.userRole,
    permissions.hasPermission,
    permissions.hasAllPermissions,
    permissions.hasAnyPermission,
    requiredPermission,
    requiredPermissions,
    requiredRole,
    requireAll
  ]);

  // Si tiene acceso, mostrar el contenido
  if (hasAccess) {
    return <>{children}</>;
  }

  // Si hay un fallback personalizado, usarlo
  if (fallback) {
    return <>{fallback}</>;
  }

  // Si debe mostrar mensaje de acceso denegado
  if (showDeniedMessage) {
    const defaultMessage = `Acceso denegado. Se requiere ${
      requiredRole ? `rol de ${requiredRole}` : 'permisos específicos'
    }.`;

    return (
      <Alert
        message="Acceso Denegado"
        description={customDeniedMessage || defaultMessage}
        type="warning"
        icon={<LockOutlined />}
        style={{ margin: '8px 0' }}
      />
    );
  }

  // Por defecto, no mostrar nada
  return null;
};

interface PermissionBadgeProps {
  requiredPermission?: Permission;
  requiredRole?: UserRole;
  children?: React.ReactNode;
  showRole?: boolean;
}

export const PermissionBadge: React.FC<PermissionBadgeProps> = ({
  requiredPermission,
  requiredRole,
  children,
  showRole = true
}) => {
  const permissions = usePermissions();

  if (!permissions.isAuthenticated) {
    return null;
  }

  const hasAccess = React.useMemo(() => {
    if (requiredRole && permissions.userRole !== requiredRole) {
      return false;
    }
    if (requiredPermission && !permissions.hasPermission(requiredPermission)) {
      return false;
    }
    return true;
  }, [permissions.userRole, permissions.hasPermission, requiredPermission, requiredRole]);

  if (!hasAccess) {
    return null;
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {children}
      {showRole && permissions.roleInfo && (
        <Text 
          style={{ 
            fontSize: '10px', 
            color: permissions.roleInfo.color,
            fontWeight: 'bold'
          }}
        >
          [{permissions.roleInfo.name}]
        </Text>
      )}
    </span>
  );
};
