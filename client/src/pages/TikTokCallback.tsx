import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LayoutContainer } from '../components/LayoutContainer';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Esta página recoge el code de TikTok y lo envía al backend para intercambiarlo por un token
const TikTokCallback: React.FC = () => {
  const navigate = useNavigate();
  const { refreshAuthState, user } = useAuth();

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
          // Ajuste: guardar token y usuario en localStorage para AuthService
          const goToWelcome = (followers: number | undefined) => {
            navigate('/welcome', { replace: true, state: { fromTikTok: true, numFollowers: followers } });
          };
          const TIMEOUT = 500;
          if (data.access_token && data.user) {
            localStorage.setItem('auth_token', data.access_token);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
            refreshAuthState();
            setTimeout(() => {
              // Comprobar solo el token en localStorage antes de navegar
              if (localStorage.getItem('auth_token')) {
                goToWelcome(data.user.follower_count);
              }
            }, TIMEOUT);
          } else if (data.success && data.token && data.user) {
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
            refreshAuthState();
            setTimeout(() => {
              if (localStorage.getItem('auth_token')) {
                goToWelcome(data.user.follower_count);
              }
            }, TIMEOUT);
          } else if (data.success && data.token) {
            // Compatibilidad con respuesta antigua
            localStorage.setItem('auth_token', data.token);
            refreshAuthState();
            setTimeout(() => {
              if (localStorage.getItem('auth_token')) {
                goToWelcome(undefined);
              }
            }, TIMEOUT);
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
