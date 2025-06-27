import React, { useState } from 'react';
import { Form, Input, Button, Alert, Typography, Card, Divider, Layout } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;
const { Content } = Layout;

export const LoginScreen: React.FC = () => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();

  const handleSubmit = async (values: { username: string; password: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      await auth.login(values.username, values.password);
      form.resetFields();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error de autenticación');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTikTokLogin = () => {
    // TODO: Implementar login con TikTok en el futuro
    console.log('Login con TikTok - Próximamente');
  };

  return (
    <Layout style={{ 
    }}>
      <Content style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '20px',
        height: '100%',
        overflow: 'auto'
      }}>
        <Card 
          style={{ 
            width: '100%', 
            maxWidth: '400px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            maxHeight: '90vh',
            overflow: 'auto'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
              ⚽ Social League
            </Title>
            <Text type="secondary">
              Sistema de gestión de ligas de fútbol
            </Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
          >
            <Form.Item
              label="Usuario"
              name="username"
              rules={[{ required: true, message: 'Por favor ingresa tu usuario' }]}
            >
              <Input
                size="large"
                prefix={<UserOutlined />}
                placeholder="Usuario"
                disabled={isLoading}
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              label="Contraseña"
              name="password"
              rules={[{ required: true, message: 'Por favor ingresa tu contraseña' }]}
            >
              <Input.Password
                size="large"
                prefix={<LockOutlined />}
                placeholder="Contraseña"
                disabled={isLoading}
                autoComplete="current-password"
              />
            </Form.Item>

            {error && (
              <Form.Item>
                <Alert
                  message="Error de Autenticación"
                  description={error}
                  type="error"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
              </Form.Item>
            )}

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={isLoading}
                size="large"
                style={{ width: '100%' }}
                icon={<UserOutlined />}
              >
                Iniciar Sesión
              </Button>
            </Form.Item>
          </Form>

          <Divider>o</Divider>

          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <Button 
              size="large"
              style={{ 
                width: '100%',
                backgroundColor: '#000',
                borderColor: '#000',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              disabled={true}
              onClick={handleTikTokLogin}
            >
              <span style={{ fontSize: '16px' }}>🎵</span>
              Continuar con TikTok
            </Button>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
              Próximamente disponible
            </div>
          </div>
        </Card>
      </Content>
    </Layout>
  );
};
