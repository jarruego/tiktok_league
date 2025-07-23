import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LayoutContainer } from '../components/LayoutContainer';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Esta página recoge el code de TikTok y lo envía al backend para intercambiarlo por un token
const TikTokCallback: React.FC = () => {
  const navigate = useNavigate();
  const { refreshAuthState } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    const state = params.get('state');
    const expectedState = sessionStorage.getItem('tiktok_csrf_state');

    if (error) {
      alert('Error en el login con TikTok: ' + error);
      navigate('/');
      return;
    }

    if (!state || state !== expectedState) {
      alert('Error de seguridad: el parámetro state no coincide (posible CSRF)');
      navigate('/');
      return;
    }

    if (code) {
      fetch(`${API_BASE_URL}/api/auth/tiktok`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
        .then(res => res.json())
        .then(data => {
          const goToWelcome = (followers: number | undefined) => {
            if (typeof followers === 'number') {
              sessionStorage.setItem('numFollowers', followers.toString());
            }
            window.location.replace('/welcome');
          };
          if (data.access_token && data.user) {
            localStorage.setItem('auth_token', data.access_token);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
            refreshAuthState();
            goToWelcome(data.user.follower_count);
          } else if (data.success && data.token && data.user) {
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
            refreshAuthState();
            goToWelcome(data.user.follower_count);
          } else if (data.success && data.token) {
            localStorage.setItem('auth_token', data.token);
            refreshAuthState();
            goToWelcome(undefined);
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
