import React, { useState } from 'react';
import { Button, Input, Form, message } from 'antd';
import { LayoutContainer } from '../components/LayoutContainer';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthGuard } from '../components/AuthGuard';

const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromTikTok = location.state && location.state.fromTikTok;
  // Leer numFollowers de sessionStorage si existe
  const numFollowers = location.state && location.state.numFollowers !== undefined
    ? location.state.numFollowers
    : (sessionStorage.getItem('numFollowers') ? Number(sessionStorage.getItem('numFollowers')) : undefined);
  // Extraer todos los datos posibles del usuario TikTok
  let tiktokUser = null;
  try {
    tiktokUser = JSON.parse(localStorage.getItem('auth_user') || 'null');
  } catch {}
  // DEBUG: Mostrar el usuario cargado y los campos de equipo
  // eslint-disable-next-line
  console.log('tiktokUser:', tiktokUser);
  // eslint-disable-next-line
  if (tiktokUser) console.log('teamId:', tiktokUser.teamId, 'team_id:', tiktokUser.team_id);

  // Nuevo: Si el usuario ya tiene equipo, redirigir a MyTeamPage
  React.useEffect(() => {
    if (tiktokUser && (tiktokUser.teamId || tiktokUser.team_id)) {
      navigate('/mi-equipo');
    }
  }, [tiktokUser, navigate]);

  // Nuevo: Estado para el nombre del equipo
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(false);

  return (
    <AuthGuard>
      <LayoutContainer>
        <div style={{ maxWidth: 480, margin: '0 auto', width: '100%', textAlign: 'center', marginTop: 80 }}>
          <h1>¡Bienvenido a Social League!</h1>
          <p style={{ fontSize: 18, margin: '32px 0' }}>
            {/* Forzar renderizado del formulario para depuración */}
            <>
              {typeof numFollowers === 'number' && numFollowers >= 0 && (
                <>Comienzas la liga con <b>{numFollowers}</b> seguidores.<br /></>
              )}
              {tiktokUser && (
                    <div style={{ margin: '24px 0', padding: 16, border: '1px solid #eee', borderRadius: 8, background: '#fafafa', display: 'inline-block', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        {tiktokUser.avatar_url && <img src={tiktokUser.avatar_url} alt="avatar" style={{ width: 64, height: 64, borderRadius: '50%' }} />}
                        <div>
                          <div>
                            <b>Usuario:</b> {
                              tiktokUser.username ||
                              tiktokUser.open_id ||
                              tiktokUser.displayName ||
                              tiktokUser.nickname ||
                              tiktokUser.unique_id ||
                              <span style={{color: 'gray'}}>No disponible</span>
                            }
                          </div>
                          {typeof numFollowers === 'number' && numFollowers >= 0 && (
                            <div><b>Seguidores:</b> {numFollowers}</div>
                          )}
                          {tiktokUser.open_id && <div><b>Open ID:</b> {tiktokUser.open_id}</div>}
                          {tiktokUser.displayName && <div><b>Nombre:</b> {tiktokUser.displayName}</div>}
                          {tiktokUser.nickname && <div><b>Nickname:</b> {tiktokUser.nickname}</div>}
                          {tiktokUser.unique_id && <div><b>Unique ID:</b> {tiktokUser.unique_id}</div>}
                          {/* Mostrar cualquier otro campo relevante automáticamente */}
                          {Object.entries(tiktokUser).map(([key, value]) => {
                            if (["username","open_id","displayName","nickname","unique_id","avatar_url"].includes(key)) return null;
                            if (typeof value === "string" || typeof value === "number") {
                              return <div key={key}><b>{key}:</b> {value}</div>;
                            }
                            return null;
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Si el usuario NO tiene equipo, mostrar formulario para asignar nombre */}
                  {!(tiktokUser?.teamId || tiktokUser?.team_id) && (
                    <Form
                      layout="vertical"
                      style={{ marginTop: 32, textAlign: 'left' }}
                      onFinish={async () => {
                        if (!teamName.trim()) return;
                        setLoading(true);
                        try {
                          // Llamar al backend para crear/asignar equipo
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
                            // Actualizar usuario en localStorage
                            const updatedUser = { ...tiktokUser, teamId: data.teamId };
                            localStorage.setItem('auth_user', JSON.stringify(updatedUser));
                            message.success('¡Equipo creado!');
                            navigate('/mi-equipo');
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
                        label="Elige el nombre de tu equipo"
                        required
                        rules={[{ required: true, message: 'Introduce un nombre para tu equipo' }]}
                      >
                        <Input
                          value={teamName}
                          onChange={e => setTeamName(e.target.value)}
                          maxLength={32}
                          placeholder="Nombre de tu equipo"
                          disabled={loading}
                        />
                      </Form.Item>
                      <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        style={{ fontSize: 18, width: '100%' }}
                        disabled={!teamName.trim() || loading}
                        loading={loading}
                      >
                        Guardar y continuar
                      </Button>
                    </Form>
                  )}
                </>
            <br />
            ¡Disfruta de la experiencia!
          </p>
        </div>
      </LayoutContainer>
    </AuthGuard>
  );
};

export default WelcomePage;
