import { Card, Typography, Tag, Divider } from 'antd';
import { LayoutContainer } from '../components/LayoutContainer';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

const { Title, Text } = Typography;

const roleDescriptions: Record<string, string> = {
  admin: 'Administrador: acceso total a todas las funciones y configuraciones.',
  moderator: 'Moderador: puede gestionar equipos, jugadores y ligas, pero no la configuración global.',
  user: 'Usuario: acceso básico, puede ver información y gestionar su propio equipo.',
};

export default function AccountPage() {
  const { user } = useAuth();
  const permissions = usePermissions();
  
  // Simulación: el usuario tiene tiktokId si su username contiene "tiktok"
  const tiktokId = user?.username?.includes('tiktok') ? user.username : null;
  const role = permissions.userRole || 'user';

  if (!user) {
    return <Card><Text>No has iniciado sesión.</Text></Card>;
  }

  return (
    <LayoutContainer>
      <div style={{ width: '100%', padding: '0 16px' }}>
        <Card style={{ width: '100%' }}>
          <Title level={3}>Cuenta de usuario</Title>
          <Divider />
          <Text strong>Usuario:</Text> <Text>{user.username}</Text><br />
          <Text strong>Tipo de cuenta:</Text> <Tag color="blue">{role}</Tag>
          <div style={{ margin: '8px 0 16px 0' }}>
            <Text type="secondary">{roleDescriptions[role]}</Text>
          </div>
          {tiktokId && (
            <>
              <Text strong>Usuario de TikTok:</Text> <Tag color="magenta">{tiktokId}</Tag><br />
            </>
          )}
        </Card>
      </div>
    </LayoutContainer>
  );
}
