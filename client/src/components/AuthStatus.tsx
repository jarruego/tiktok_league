import React, { useState, useEffect } from 'react';
import { Button, Dropdown, Avatar, Typography, Space } from 'antd';
import { UserOutlined, LogoutOutlined, LoginOutlined } from '@ant-design/icons';
import { authApi } from '../api/authApi';
import { LoginModal } from './LoginModal';

const { Text } = Typography;

interface AuthStatusProps {
  style?: React.CSSProperties;
  size?: 'small' | 'middle' | 'large';
}

export const AuthStatus: React.FC<AuthStatusProps> = ({ style, size = 'middle' }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ id: number; username: string } | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Verificar estado de autenticación al montar el componente
  useEffect(() => {
    updateAuthState();
  }, []);

  const updateAuthState = () => {
    const authState = authApi.getAuthState();
    setIsAuthenticated(authState.isAuthenticated);
    setUser(authState.user);
  };

  const handleLogin = () => {
    setShowLoginModal(true);
  };

  const handleLoginSuccess = () => {
    updateAuthState();
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    authApi.logout();
    updateAuthState();
  };

  const dropdownItems = [
    {
      key: 'user-info',
      label: (
        <div style={{ padding: '8px 0' }}>
          <Text strong>{user?.username}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Sesión activa
          </Text>
        </div>
      ),
      disabled: true,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      label: (
        <Space>
          <LogoutOutlined />
          Cerrar Sesión
        </Space>
      ),
      onClick: handleLogout,
    },
  ];

  if (!isAuthenticated) {
    return (
      <>
        <Button
          type="default"
          icon={<LoginOutlined />}
          onClick={handleLogin}
          size={size}
          style={style}
        >
          Iniciar Sesión
        </Button>
        
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLogin={handleLoginSuccess}
        />
      </>
    );
  }

  return (
    <Dropdown
      menu={{ items: dropdownItems }}
      placement="bottomRight"
      trigger={['click']}
    >
      <Button
        type="text"
        size={size}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          ...style 
        }}
      >
        <Avatar 
          size={size === 'small' ? 24 : size === 'large' ? 32 : 28} 
          icon={<UserOutlined />} 
        />
        <span>{user?.username}</span>
      </Button>
    </Dropdown>
  );
};
