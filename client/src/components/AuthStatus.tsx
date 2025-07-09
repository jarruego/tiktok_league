import React from 'react';
import { Button, Dropdown, Avatar, Typography, Space, Tag } from 'antd';
import { UserOutlined, LogoutOutlined, CrownOutlined, SafetyOutlined, SettingOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { Link } from 'react-router-dom';

const { Text } = Typography;

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
      key: 'user-info',
      label: (
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Text strong>{permissions.user?.username}</Text>
            {permissions.roleInfo && (
              <Tag color={permissions.roleInfo.color} style={{ margin: 0, fontSize: '10px' }}>
                {permissions.roleInfo.name}
              </Tag>
            )}
          </div>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            Sesión activa
          </Text>
          {permissions.roleInfo && (
            <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
              {permissions.roleInfo.description}
            </div>
          )}
        </div>
      ),
      disabled: true,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'account',
      label: (
        <Link to="/account" style={{ fontWeight: 500, color: '#222' }}>
          Mi cuenta
        </Link>
      ),
    },
    ...(permissions.isAdmin ? [
      {
        key: 'config',
        label: (
          <Link to="/config" style={{ fontWeight: 500, color: '#222' }}>
            <Space>
              <SettingOutlined />
              Configuración
            </Space>
          </Link>
        ),
      }
    ] : []),
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
          gap: '8px',
          ...style 
        }}
      >
        <Avatar 
          size={size === 'small' ? 24 : size === 'large' ? 32 : 28} 
          icon={getRoleIcon()}
          style={{
            backgroundColor: permissions.roleInfo?.color || '#1890ff'
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ fontSize: size === 'small' ? '12px' : '14px' }}>
            {permissions.user?.username}
          </span>
          {permissions.roleInfo && (
            <span style={{ 
              fontSize: '10px', 
              color: permissions.roleInfo.color,
              lineHeight: 1
            }}>
              {permissions.roleInfo.name}
            </span>
          )}
        </div>
      </Button>
    </Dropdown>
  );
};
