import React, { useState } from 'react';
import { Form, Input, Button, Alert, Card, Divider, Layout, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Content } = Layout;


export const LoginScreen: React.FC = () => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPro, setShowPro] = useState(false);
  const auth = useAuth();
  const { setUser } = auth;

  React.useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      if (typeof auth.user.teamId === 'number' && auth.user.teamId) {
        window.location.replace('/mi-equipo');
      } else {
        window.location.replace('/welcome');
      }
    }
  }, [auth.isAuthenticated, auth.user?.teamId]);

  const handleSubmit = async (values: { username: string; password: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      await auth.login(values.username, values.password);
      const token = localStorage.getItem('auth_token');
      if (token) {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/auth/me`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const user = await res.json();
          if (setUser) setUser(user);
        }
      }
      form.resetFields();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error de autenticación');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTikTokLogin = () => {
    const client_id = import.meta.env.VITE_TIKTOK_CLIENT_ID || '';
    const redirect_uri = encodeURIComponent(window.location.origin + '/tiktok-callback');
    const scope = 'user.info.basic';
    const array = new Uint8Array(30);
    const csrfState = Array.from(window.crypto.getRandomValues(array), b => b.toString(36)).join('');
    sessionStorage.setItem('tiktok_csrf_state', csrfState);
    const authUrl =
      `https://www.tiktok.com/v2/auth/authorize?` +
      `client_key=${client_id}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&redirect_uri=${redirect_uri}` +
      `&state=${csrfState}`;
    window.location.href = authUrl;
  };

  return (
    <Layout>
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
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Typography.Text style={{ fontSize: 16 }}>
              Para acceder al juego debes iniciar sesión con tu cuenta de TikTok
            </Typography.Text>
          </div>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
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
                gap: '8px',
                fontWeight: 600
              }}
              onClick={handleTikTokLogin}
            >
              <span style={{ fontSize: '16px' }}>🎵</span>
              Continuar con TikTok
            </Button>
          </div>

          <Divider plain style={{ margin: '16px 0' }} />


          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Button type="link" onClick={() => setShowPro(v => !v)} style={{ fontSize: '14px', fontStyle: 'italic', padding: 0 }}>
              {showPro ? 'Ocultar formulario PRO' : 'Tengo una cuenta PRO'}
            </Button>
          </div>

          {showPro && (
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              autoComplete="off"
              style={{ marginTop: 8 }}
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
          )}
        </Card>
      </Content>
      <footer style={{
        textAlign: 'center',
        marginTop: '16px',
        fontSize: '12px',
        color: '#888',
        width: '100%'
      }}>
        <span>
          <a href="/terms" target="_blank" rel="noopener noreferrer">Términos de Servicio</a> |{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">Política de Privacidad</a>
        </span>
      </footer>
    </Layout>
  );
};
