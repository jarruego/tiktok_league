import { Card, Typography, Tag, Divider, Button } from 'antd';
import { Link } from 'react-router-dom';
import { LayoutContainer } from '../components/LayoutContainer';
import { MatchSimulationDashboard } from '../components/MatchSimulationDashboard';
import { useAccountPageLogic } from '../hooks/useAccountPageLogic';

const { Title, Text } = Typography;

const roleDescriptions: Record<string, string> = {
  admin: 'Administrador: acceso total a todas las funciones y configuraciones.',
  moderator: 'Moderador: puede gestionar equipos, jugadores y ligas, pero no la configuración global.',
  user: 'Usuario: acceso básico, puede ver información y gestionar su propio equipo.',
};

const permissionLabels: Record<string, string> = {
  reset_system: 'Resetear sistema',
  view_system_info: 'Ver información del sistema',
  initialize_system: 'Inicializar sistema',
  create_team: 'Crear equipo',
  edit_team: 'Editar equipo',
  delete_team: 'Eliminar equipo',
  view_team_details: 'Ver detalles de equipo',
  create_player: 'Crear jugador',
  edit_player: 'Editar jugador',
  delete_player: 'Eliminar jugador',
  sync_players: 'Sincronizar jugadores',
  create_season: 'Crear temporada',
  assign_teams: 'Asignar equipos',
  view_league_management: 'Ver gestión de ligas',
  view_config: 'Ver configuración',
  edit_config: 'Editar configuración',
  manage_competitions: 'Gestionar competiciones',
  manage_users: 'Gestionar usuarios',
  view_user_list: 'Ver lista de usuarios',
};

export default function AccountPage() {
  const {
    user,
    permissions,
    tiktokId,
    role,
    userPermissions,
    loading,
    caching,
    simulatingMatches,
    showSimulationDashboard,
    handleInitializeSystem,
    handleResetSystem,
    handleCacheAllCompetitions,
    handleSimulateNextMatchday,
    handleOpenSimulationDashboard,
    handleCloseSimulationDashboard
  } = useAccountPageLogic();

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
          <Divider />
          <Text strong>Permisos:</Text>
          <ul style={{ marginTop: 8 }}>
            {userPermissions.map(perm => (
              <li key={perm}>
                <Tag color="geekblue">{perm}</Tag> {permissionLabels[perm] || perm}
              </li>
            ))}
          </ul>
          {/* Herramientas de administrador */}
          {permissions.isAdmin && (
            <>
              <Divider />
              <Text strong>Herramientas de administrador</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                <Button type="primary" loading={loading} onClick={handleInitializeSystem}>
                  Inicializar Sistema de Ligas
                </Button>
                <Button 
                  type="primary" 
                  onClick={handleOpenSimulationDashboard}
                  style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                >
                  ⚽ Gestionar Simulación de Partidos
                </Button>
                <Button danger loading={loading} onClick={handleResetSystem}>
                  Reset del Sistema
                </Button>
                <Button type="dashed" loading={caching} onClick={handleCacheAllCompetitions}>
                  Poblar Caché de Competiciones
                </Button>
                <Link to="/leagues">
                  <Button type="default" style={{ width: '100%' }}>
                    Ver Ligas y Equipos (cache football-data)
                  </Button>
                </Link>
              </div>
            </>
          )}

          {/* Dashboard de Simulación */}
          <MatchSimulationDashboard
            visible={showSimulationDashboard}
            onClose={handleCloseSimulationDashboard}
            onSimulate={handleSimulateNextMatchday}
            loading={simulatingMatches}
          />
        </Card>
      </div>
    </LayoutContainer>
  );
}
