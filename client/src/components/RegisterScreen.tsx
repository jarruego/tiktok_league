import React, { useState } from 'react';
import { Form, Input, Button, Alert, Card, Divider, Layout } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Content } = Layout;

export const RegisterScreen: React.FC = () => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (values: { username: string; email: string; password: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (!res.ok) {
        // Intenta extraer errores de validación del backend
        let msg = await res.text();
        try {
          const json = JSON.parse(msg);
          msg = json.message || msg;
        } catch {}
        throw new Error(msg);
      }
      form.resetFields();
      navigate('/login?registered=1');
    } catch (err: any) {
      setError(err.message || 'Error en el registro');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', height: '100%', overflow: 'auto' }}>
        <Card style={{ width: '100%', maxWidth: '400px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', maxHeight: '90vh', overflow: 'auto' }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            validateTrigger={["onChange", "onBlur"]}
            autoComplete="off"
          >
            <Form.Item label="Usuario" name="username" rules={[{ required: true, message: 'Por favor ingresa tu usuario' }]}> <Input size="large" prefix={<UserOutlined />} placeholder="Usuario" disabled={isLoading} autoComplete="username" /> </Form.Item>
            <Form.Item label="Email" name="email" rules={[{ required: true, message: 'Por favor ingresa tu email' }, { type: 'email', message: 'Email no válido' }]}> <Input size="large" prefix={<MailOutlined />} placeholder="Email" disabled={isLoading} autoComplete="email" /> </Form.Item>
            <Form.Item label="Contraseña" name="password" rules={[{ required: true, message: 'Por favor ingresa tu contraseña' }, { min: 6, message: 'Mínimo 6 caracteres' }]}> <Input.Password size="large" prefix={<LockOutlined />} placeholder="Contraseña" disabled={isLoading} autoComplete="new-password" /> </Form.Item>
            {error && (<Form.Item><Alert message="Error en el registro" description={error} type="error" showIcon style={{ marginBottom: '16px' }} /></Form.Item>)}
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={isLoading} size="large" style={{ width: '100%' }} icon={<UserOutlined />}>Crear cuenta</Button>
            </Form.Item>
          </Form>
          <Divider>o</Divider>
          <div style={{ textAlign: 'center' }}>
            <Button type="link" onClick={() => navigate('/login')}>¿Ya tienes cuenta? Inicia sesión</Button>
          </div>
        </Card>
      </Content>
    </Layout>
  );
};
