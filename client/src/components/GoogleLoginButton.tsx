import { GoogleLogin } from '@react-oauth/google';
import { message } from 'antd';
import { authService } from '../api/authApi';

export const GoogleLoginButton = () => {
  const handleSuccess = async (credentialResponse: any) => {
    try {
      // credentialResponse.credential es el ID token de Google
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // Guardar el token y usuario en el AuthService usando método público
      authService.loginWithSocial(data.access_token, data.user);
    } catch (err: any) {
      message.error(err.message || 'Error con Google Sign-In');
    }
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => message.error('Error con Google Sign-In')}
      useOneTap
    />
  );
};
