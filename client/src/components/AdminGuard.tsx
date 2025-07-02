import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { LoginScreen } from './LoginScreen';
import { Result } from 'antd';

interface AdminGuardProps {
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const permissions = usePermissions();

  if (!permissions.isAuthenticated) {
    return <LoginScreen />;
  }

  if (!permissions.isAdmin) {
    return (
      <Result
        status="403"
        title="Acceso restringido"
        subTitle="Esta sección solo está disponible para administradores."
      />
    );
  }

  return <>{children}</>;
};
