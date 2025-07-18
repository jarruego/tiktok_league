import React from 'react';
import { Button } from 'antd';
import { LayoutContainer } from '../components/LayoutContainer';
import { useLocation } from 'react-router-dom';

const WelcomePage: React.FC = () => {
  const location = useLocation();
  const fromTikTok = location.state && location.state.fromTikTok;
  const numFollowers = location.state && location.state.numFollowers;

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
