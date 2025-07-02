import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutContainer } from '../components/LayoutContainer';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Esta página recoge el code de TikTok y lo envía al backend para intercambiarlo por un token
const TikTokCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      // Manejar error de login
      alert('Error en el login con TikTok: ' + error);
      navigate('/');
      return;
    }

    if (code) {
      // Aquí deberías enviar el code a tu backend para intercambiarlo por un token
      fetch(`${API_BASE_URL}/api/auth/tiktok`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // Guardar token, redirigir, etc.
            // Por ejemplo, guardar en localStorage y navegar
            localStorage.setItem('token', data.token);
            navigate('/');
          } else {
            alert('No se pudo iniciar sesión con TikTok');
            navigate('/');
          }
        })
        .catch(() => {
          alert('Error al conectar con el backend');
          navigate('/');
        });
    }
  }, [navigate]);

  return (
    <LayoutContainer>
      <div style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <h2 style={{ textAlign: 'center', marginTop: 60 }}>
          Procesando inicio de sesión con TikTok...
        </h2>
      </div>
    </LayoutContainer>
  );
};

export default TikTokCallback;
