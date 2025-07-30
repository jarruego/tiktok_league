import React from 'react';
import { Button, Dropdown, Avatar, Space } from 'antd';
import { UserOutlined, LogoutOutlined, CrownOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { Link } from 'react-router-dom';


interface AuthStatusProps {
  style?: React.CSSProperties;
  size?: 'small' | 'middle' | 'large';
}

export const AuthStatus: React.FC<AuthStatusProps> = ({ style, size = 'middle' }) => {
  const auth = useAuth();
  const permissions = usePermissions();

  const handleLogout = () => {
    auth.logout();
  };

  const getRoleIcon = () => {
    if (permissions.isAdmin) return <CrownOutlined />;
    if (permissions.isModerator) return <SafetyOutlined />;
    return <UserOutlined />;
  };

  if (!permissions.isAuthenticated) {
    return null;
  }

  const dropdownItems = [
    {
      key: 'account',
      label: (
        <Link to="/account" style={{ fontWeight: 500, color: '#222' }}>
          Mi cuenta
        </Link>
      ),
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
          padding: 0,
          ...style
        }}
      >
        <Avatar
          size={size === 'small' ? 24 : size === 'large' ? 32 : 28}
          icon={getRoleIcon()}
          style={{
            backgroundColor: permissions.roleInfo?.color || '#1890ff',
            verticalAlign: 'middle'
          }}
        />
      </Button>
    </Dropdown>
  );
};
