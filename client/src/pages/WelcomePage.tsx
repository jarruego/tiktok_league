import React from 'react';
import { Button } from 'antd';
import { LayoutContainer } from '../components/LayoutContainer';
import { useLocation } from 'react-router-dom';

const WelcomePage: React.FC = () => {
  const location = useLocation();
  const fromTikTok = location.state && location.state.fromTikTok;

  return (
    <LayoutContainer>
      <div style={{ maxWidth: 480, margin: '0 auto', width: '100%', textAlign: 'center', marginTop: 80 }}>
        <h1>¡Bienvenido a Soccer Legends!</h1>
        <p style={{ fontSize: 18, margin: '32px 0' }}>
          {fromTikTok
            ? '¡Has iniciado sesión con TikTok correctamente!'
            : 'Has accedido correctamente.'}
          <br />
          ¡Disfruta de la experiencia y explora todas las funcionalidades de la app!
        </p>
        <Button type="primary" size="large" style={{ fontSize: 18 }}>
          Continuar
        </Button>
      </div>
    </LayoutContainer>
  );
};

export default WelcomePage;
