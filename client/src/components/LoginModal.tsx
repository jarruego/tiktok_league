import React, { useState } from 'react';
import { Modal, Form, Input, Button, Alert, Typography, Card, Divider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Text } = Typography;

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin }) => {
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
      onLogin();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error de autenticación');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setError(null);
    onClose();
  };

  return (
    <Modal
      title="🔐 Autenticación Requerida"
      open={isOpen}
      onCancel={handleCancel}
      footer={null}
      width={400}
      centered
      maskClosable={!isLoading}
      closable={!isLoading}
    >
      <div style={{ marginBottom: '16px' }}>
        <Text type="secondary">
          Se requiere autenticación para realizar operaciones administrativas.
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
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button onClick={handleCancel} disabled={isLoading}>
              Cancelar
            </Button>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={isLoading}
              icon={<UserOutlined />}
            >
              Iniciar Sesión
            </Button>
          </div>
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
          onClick={() => {
            // TODO: Implementar login con TikTok en el futuro
            console.log('Login con TikTok - Próximamente');
          }}
        >
          <span style={{ fontSize: '16px' }}>🎵</span>
          Continuar con TikTok
        </Button>
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
          Próximamente disponible
        </div>
      </div>

      <Card 
        size="small" 
        style={{ backgroundColor: '#f5f5f5', marginTop: '16px' }}
        title="💡 Credenciales por defecto"
      >
        <Text strong>Usuario:</Text> <Text code>admin</Text><br />
        <Text strong>Contraseña:</Text> <Text code>admin123</Text>
      </Card>
    </Modal>
  );
};
