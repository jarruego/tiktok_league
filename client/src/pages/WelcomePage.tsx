import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Form, message } from 'antd';
import { LayoutContainer } from '../components/LayoutContainer';
import { useNavigate } from 'react-router-dom';
import { AuthGuard } from '../components/AuthGuard';

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();

  // Extraer usuario TikTok de localStorage
  let tiktokUser = null;
  try {
    tiktokUser = JSON.parse(localStorage.getItem('auth_user') || 'null');
  } catch {}

  // Acceso al contexto de autenticación
  const { setUser } = useAuth();

  // Si el usuario ya tiene equipo, redirigir a MyTeamPage
  React.useEffect(() => {
    if (tiktokUser && (tiktokUser.teamId || tiktokUser.team_id)) {
      navigate('/mi-equipo');
    }
  }, [tiktokUser, navigate]);

  // Estado para el nombre del equipo
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <AuthGuard>
      <LayoutContainer>
        <div style={{ maxWidth: 420, margin: '0 auto', width: '100%', textAlign: 'center', marginTop: 80, background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px #0001', padding: 40 }}>
          <h1 style={{ fontWeight: 700, fontSize: 32, marginBottom: 16 }}>¡Bienvenido a Social League!</h1>
          <p style={{ fontSize: 18, color: '#444', marginBottom: 32 }}>
            Para comenzar, elige el nombre de tu equipo. <br />
            Este será tu club en la liga.
          </p>
          <Form
            layout="vertical"
            style={{ marginTop: 8, textAlign: 'left' }}
            onFinish={async () => {
              if (!teamName.trim()) return;
              setLoading(true);
              try {
                const token = localStorage.getItem('auth_token');
                const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/teams/create-for-user`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                  },
                  body: JSON.stringify({ name: teamName, tiktokId: tiktokUser?.open_id || '' })
                });
                const data = await res.json();
                if (res.ok && data.success) {
                  // Obtener usuario actualizado del backend
                  let refreshedUser = null;
                  try {
                    const userRes = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/auth/me`, {
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                      }
                    });
                    if (userRes.ok) {
                      refreshedUser = await userRes.json();
                    }
                  } catch {}
                  if (refreshedUser && refreshedUser.teamId) {
                    localStorage.setItem('auth_user', JSON.stringify(refreshedUser));
                    if (setUser) setUser(refreshedUser);
                  } else {
                    // Fallback: actualizar solo el teamId
                    const updatedUser = { ...tiktokUser, teamId: data.teamId };
                    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
                    if (setUser) setUser(updatedUser);
                  }
                  message.success('¡Equipo creado!');
                  setTimeout(() => {
                    navigate('/mi-equipo');
                  }, 300);
                } else {
                  message.error(data.message || 'No se pudo crear el equipo');
                }
              } catch (err) {
                message.error('Error al conectar con el backend');
              } finally {
                setLoading(false);
              }
            }}
          >
            <Form.Item
              label={<span style={{ fontWeight: 500, fontSize: 18 }}>Nombre de tu equipo</span>}
              required
              rules={[{ required: true, message: 'Introduce un nombre para tu equipo' }]}
            >
              <Input
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                maxLength={32}
                placeholder="Ejemplo: Los Galácticos"
                disabled={loading}
                size="large"
                style={{ fontSize: 18, borderRadius: 8 }}
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              style={{ fontSize: 18, width: '100%', borderRadius: 8 }}
              disabled={!teamName.trim() || loading}
              loading={loading}
            >
              Guardar y continuar
            </Button>
          </Form>
        </div>
      </LayoutContainer>
    </AuthGuard>
  );
};

export default WelcomePage;
