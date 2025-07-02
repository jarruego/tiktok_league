import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { LoginScreen } from './LoginScreen';

interface AdminGuardProps {
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const permissions = usePermissions();

  if (!permissions.isAuthenticated) {
    return <LoginScreen />;
  }

  if (!permissions.isAdmin) {
    return null;
  }

  return <>{children}</>;
};
