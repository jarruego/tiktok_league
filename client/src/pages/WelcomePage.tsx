import React from 'react';
import { Button } from 'antd';
import { LayoutContainer } from '../components/LayoutContainer';
import { useLocation } from 'react-router-dom';

const WelcomePage: React.FC = () => {
  const location = useLocation();
  const fromTikTok = location.state && location.state.fromTikTok;
  const numFollowers = location.state && location.state.numFollowers;
  // Extraer todos los datos posibles del usuario TikTok
  let tiktokUser = null;
  try {
    tiktokUser = JSON.parse(localStorage.getItem('auth_user') || 'null');
  } catch {}

  return (
    <LayoutContainer>
      <div style={{ maxWidth: 480, margin: '0 auto', width: '100%', textAlign: 'center', marginTop: 80 }}>
        <h1>¡Bienvenido a Soccer Legends!</h1>
        <p style={{ fontSize: 18, margin: '32px 0' }}>
          {fromTikTok
            ? <>
                ¡Has iniciado sesión con TikTok correctamente!<br />
                {typeof numFollowers === 'number' && numFollowers >= 0 && (
                  <>Comienzas la liga con <b>{numFollowers}</b> seguidores.<br /></>
                )}
                {tiktokUser && (
                  <div style={{ margin: '24px 0', padding: 16, border: '1px solid #eee', borderRadius: 8, background: '#fafafa', display: 'inline-block', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      {tiktokUser.avatar_url && <img src={tiktokUser.avatar_url} alt="avatar" style={{ width: 64, height: 64, borderRadius: '50%' }} />}
                      <div>
                        <div><b>Usuario:</b> {tiktokUser.username || tiktokUser.open_id}</div>
                        {typeof numFollowers === 'number' && numFollowers >= 0 && (
                          <div><b>Seguidores:</b> {numFollowers}</div>
                        )}
                        {tiktokUser.open_id && <div><b>Open ID:</b> {tiktokUser.open_id}</div>}
                        {tiktokUser.displayName && <div><b>Nombre:</b> {tiktokUser.displayName}</div>}
                        {/* Puedes añadir más campos si el objeto los tiene */}
                      </div>
                    </div>
                  </div>
                )}
              </>
            : 'Has accedido correctamente.'}
          <br />
          ¡Disfruta de la experiencia!
        </p>
        <Button type="primary" size="large" style={{ fontSize: 18 }}>
          Continuar
        </Button>
      </div>
    </LayoutContainer>
  );
};

export default WelcomePage;
