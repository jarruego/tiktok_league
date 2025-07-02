import React from 'react';
import { Button } from 'antd';
import { LayoutContainer } from '../components/LayoutContainer';

const WelcomePage: React.FC = () => {
  return (
    <LayoutContainer>
      <div style={{ maxWidth: 480, margin: '0 auto', width: '100%', textAlign: 'center', marginTop: 80 }}>
        <h1>¡Bienvenido a Soccer Legends!</h1>
        <p style={{ fontSize: 18, margin: '32px 0' }}>
          Has accedido correctamente.<br />
          ¡Disfruta de la experiencia y explora todas las funcionalidades de la app!
        </p>
        <Button type="primary" size="large" disabled style={{ fontSize: 18 }}>
          Continuar
        </Button>
      </div>
    </LayoutContainer>
  );
};

export default WelcomePage;
