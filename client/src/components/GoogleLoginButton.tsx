import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { message } from 'antd';

export const GoogleLoginButton = () => {
  const auth = useAuth();

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
      // Llama al login del contexto para guardar el usuario y token
      await auth.login(data.user.username, data.googleLoginBypassPassword || '');
      // O puedes guardar el token manualmente si tienes un método
      // auth.setGoogleAuth(data.access_token, data.user)
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
