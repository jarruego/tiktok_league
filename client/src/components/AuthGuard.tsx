import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from './LoginScreen';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Dar un momento para que el contexto se inicialice
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Mostrar spinner mientras se inicializa
  if (isInitializing) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column'
      }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px', color: '#666' }}>
          Cargando aplicación...
        </div>
      </div>
    );
  }

  // Si no está autenticado, mostrar la pantalla de login
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Si está autenticado, mostrar el contenido de la aplicación
  return <>{children}</>;
};
