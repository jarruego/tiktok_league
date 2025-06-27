import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthState } from '../api/authApi';
import { authService } from '../api/authApi';

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAuthState: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(() => {
    // Inicializar con el estado actual del servicio
    return authService.getAuthState();
  });

  const refreshAuthState = () => {
    setAuthState(authService.getAuthState());
  };

  useEffect(() => {
    // Suscribirse a cambios en el servicio de autenticación
    const unsubscribe = authService.subscribe(refreshAuthState);
    return unsubscribe;
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    await authService.login(username, password);
    refreshAuthState();
  };

  const logout = (): void => {
    authService.logout();
    refreshAuthState();
  };

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    refreshAuthState,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
