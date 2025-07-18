import React from 'react';
import { Button } from 'antd';
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

  return (
    <AuthGuard>
      <LayoutContainer>
        <div style={{ maxWidth: 480, margin: '0 auto', width: '100%', textAlign: 'center', marginTop: 80 }}>
          <h1>¡Bienvenido a Social League!</h1>
          <p style={{ fontSize: 18, margin: '32px 0' }}>
            {fromTikTok
              ? <>
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
                </>
              : 'Has accedido correctamente.'}
            <br />
            ¡Disfruta de la experiencia!
          </p>
        <Button type="primary" size="large" style={{ fontSize: 18 }} onClick={() => navigate('/mi-equipo')}>
          Continuar
        </Button>
        </div>
      </LayoutContainer>
    </AuthGuard>
  );
};

export default WelcomePage;
