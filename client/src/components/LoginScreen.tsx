import React, { useState } from 'react';
import { Form, Input, Button, Alert, Card, Divider, Layout } from 'antd';
import { GoogleLoginButton } from './GoogleLoginButton';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;


export const LoginScreen: React.FC = () => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();
  const navigate = useNavigate();

  // Redirigir tras login exitoso (usuario/pass, Google, TikTok)
  React.useEffect(() => {
    if (auth.isAuthenticated && auth.user && typeof auth.user.teamId === 'number') {
      navigate('/mi-equipo', { replace: true });
    }
  }, [auth.isAuthenticated, auth.user?.teamId, navigate]);

  const handleSubmit = async (values: { username: string; password: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      await auth.login(values.username, values.password);
      form.resetFields();
      // La redirección se maneja en el useEffect
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
    // Generar state seguro usando window.crypto
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
            <GoogleLoginButton />
          </div>
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
              onClick={handleTikTokLogin}
            >
              <span style={{ fontSize: '16px' }}>🎵</span>
              Continuar con TikTok
            </Button>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Button type="link" onClick={() => navigate('/register')}>¿No tienes cuenta? Regístrate</Button>
          </div>
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
