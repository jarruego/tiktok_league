import { useState, useEffect } from 'react';
import { Table, Select, Spin, Alert, Typography, Card, Tag, Button, message, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';
import { leagueApi } from '../../api/leagueApi';
import { authApi } from '../../api/authApi';
import { LoginModal } from '../LoginModal';
import { AuthStatus } from '../AuthStatus';
import type { Division, Season, TeamInLeague } from '../../types/league.types';
import type { ColumnsType } from 'antd/es/table';
import { formatNumber } from '../../utils/formatters';
import '../../styles/common.css';
import '../../styles/DivisionView.css';

const { Title, Text } = Typography;
const { Option } = Select;

interface ExtendedTeamInLeague extends TeamInLeague {
  position?: number;
}

// Función para determinar el estado de clasificación de un equipo (optimizada)
const getTeamStatus = (
  position: number, 
  division: Division, 
  totalTeamsInLeague: number
): { status: string; color: string; badge: string; backgroundColor: string } => {
  const { level, europeanSlots, promoteSlots, promotePlayoffSlots, relegateSlots } = division;
  
  // Plazas europeas (solo División 1)
  if (level === 1 && position <= europeanSlots) {
    return {
      status: 'european',
      color: '#1890ff',
      badge: '🏆 Europa',
      backgroundColor: '#e6f7ff'
    };
  }

  // Ascenso directo
  if (level > 1 && position <= promoteSlots) {
    return {
      status: 'promotion',
      color: '#52c41a',
      badge: '⬆️ Asciende',
      backgroundColor: '#f6ffed'
    };
  }

  // Playoff de ascenso
  if (level > 1 && 
      position > promoteSlots && 
      position <= (promoteSlots + promotePlayoffSlots)) {
    return {
      status: 'playoff',
      color: '#fa8c16',
      badge: '🎯 Playoff',
      backgroundColor: '#fff7e6'
    };
  }

  // Descenso
  if (relegateSlots > 0 && 
      position > (totalTeamsInLeague - relegateSlots)) {
    return {
      status: 'relegation',
      color: '#ff4d4f',
      badge: '⬇️ Desciende',
      backgroundColor: '#fff2f0'
    };
  }

  // Posición segura
  return {
    status: 'safe',
    color: '#8c8c8c',
    badge: '✓ Seguro',
    backgroundColor: '#ffffff'
  };
};

// Mapeo de razones de asignación (optimizado)
const ASSIGNMENT_REASONS = {
  0: { text: 'TikTok', color: 'blue' },
  1: { text: 'Ascenso', color: 'green' },
  2: { text: 'Descenso', color: 'red' },
  3: { text: 'Playoff', color: 'orange' },
  4: { text: 'Disponibilidad', color: 'purple' }
} as const;

const getAssignmentReasonText = (reason: number) => {
  return ASSIGNMENT_REASONS[reason as keyof typeof ASSIGNMENT_REASONS] || 
         { text: 'Desconocido', color: 'default' };
};

// Función para crear las columnas dinámicamente según la división (optimizada con memoización)
const createColumns = (selectedDivision: Division | null, navigate: any): ColumnsType<ExtendedTeamInLeague> => {
  const handleTeamClick = (teamId: number) => navigate(`/team/${teamId}`);
  
  return [
    { 
      title: 'Pos', 
      dataIndex: 'position', 
      key: 'position', 
      width: 60,
      render: (position: number) => position || '-',
    },
    { 
      title: 'Estado', 
      key: 'status', 
      width: 120,
      render: (_, record: ExtendedTeamInLeague) => {
        if (!selectedDivision || !record.position) return null;
        
        const status = getTeamStatus(record.position, selectedDivision, 20); // Asumimos 20 equipos por liga
        return (
          <Tag color={status.color} style={{ margin: 0 }}>
            {status.badge}
          </Tag>
        );
      }
    },
    { 
      title: 'Escudo', 
      dataIndex: 'crest', 
      key: 'crest',
      width: 60,
      render: (crest: string, record: ExtendedTeamInLeague) => (
        <Tooltip title={`Haz clic para ver detalles de ${record.teamName}`}>
          <div 
            className="clickable-crest"
            style={{ display: 'flex', justifyContent: 'center' }}
            onClick={() => handleTeamClick(record.teamId)}
          >
            {crest ? (
              <img 
                src={crest} 
                alt={record.teamName} 
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Text type="secondary">?</Text>
              </div>
            )}
          </div>
        </Tooltip>
      )
    },
    { 
      title: 'Equipo', 
      dataIndex: 'teamName', 
      key: 'teamName',
      render: (teamName: string, record: ExtendedTeamInLeague) => (
        <Tooltip title={`Haz clic para ver el perfil completo de ${record.teamName}`}>
          <div 
            className="clickable-team"
            onClick={() => handleTeamClick(record.teamId)}
          >
            <div className="clickable-team-name" style={{ fontWeight: 500 }}>{teamName}</div>
            {record.shortName && record.shortName !== teamName && (
              <Text type="secondary" style={{ fontSize: '12px' }}>{record.shortName}</Text>
            )}
          </div>
        </Tooltip>
      )
    },
    { 
      title: 'Seguidores Actuales', 
      dataIndex: 'tiktokFollowers', 
      key: 'tiktokFollowers', 
      sorter: (a, b) => b.tiktokFollowers - a.tiktokFollowers,
      render: (followers: number) => formatNumber(followers)
    },
    { 
      title: 'Seguidores al Asignar', 
      dataIndex: 'followersAtAssignment', 
      key: 'followersAtAssignment',
      render: (followers: number) => formatNumber(followers)
    },
    { 
      title: 'Motivo Asignación', 
      dataIndex: 'assignmentReason', 
      key: 'assignmentReason',
      render: (reason: number) => {
        const { text, color } = getAssignmentReasonText(reason);
        return <Tag color={color}>{text}</Tag>;
      }
    },
  ];
};

export default function DivisionView() {
  const navigate = useNavigate();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [teams, setTeams] = useState<ExtendedTeamInLeague[]>([]);
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [systemInitialized, setSystemInitialized] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingAdminAction, setPendingAdminAction] = useState<(() => Promise<void>) | null>(null);

  // Helper para verificar autenticación antes de operaciones administrativas
  const executeWithAuth = async (action: () => Promise<void>) => {
    if (!authApi.isAuthenticated()) {
      setPendingAdminAction(() => action);
      setShowLoginModal(true);
      return;
    }
    await action();
  };

  // Callback para cuando el login es exitoso
  const handleLoginSuccess = async () => {
    if (pendingAdminAction) {
      try {
        await pendingAdminAction();
      } catch (error) {
        console.error('Error ejecutando acción administrativa:', error);
      } finally {
        setPendingAdminAction(null);
      }
    }
  };

  // Cargar datos iniciales
  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Intentar obtener la temporada activa
      let activeSeason: Season | null = null;
      try {
        activeSeason = await leagueApi.getActiveSeason();
        setSeason(activeSeason);
      } catch (error) {
        console.log('No hay temporada activa, el sistema puede no estar inicializado');
      }

      // Intentar obtener la estructura de divisiones
      let divisionStructure: Division[] = [];
      try {
        divisionStructure = await leagueApi.getDivisionStructure();
        setDivisions(divisionStructure);
        
        if (divisionStructure.length > 0) {
          // Seleccionar División 1 por defecto
          const division1 = divisionStructure.find(d => d.level === 1) || divisionStructure[0];
          setSelectedDivision(division1);
          
          if (division1.leagues.length > 0) {
            setSelectedLeague(division1.leagues[0].id);
          }
          setSystemInitialized(true);
        }
      } catch (error) {
        console.log('Sistema de ligas no inicializado');
        setSystemInitialized(false);
      }

    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
      message.error('Error cargando los datos del sistema de ligas');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamsInLeague = async (leagueId: number, seasonId: number) => {
    try {
      setTeamsLoading(true);
      const teamsData = await leagueApi.getTeamsInLeague(leagueId, seasonId);
      
      // Añadir posición basada en seguidores al momento de asignación
      const teamsWithPosition = teamsData
        .sort((a, b) => b.followersAtAssignment - a.followersAtAssignment)
        .map((team, index) => ({
          ...team,
          position: index + 1
        }));
      
      setTeams(teamsWithPosition);
    } catch (error) {
      console.error('Error cargando equipos:', error);
      message.error('Error cargando los equipos de la liga');
      setTeams([]);
    } finally {
      setTeamsLoading(false);
    }
  };

  const handleInitializeSystem = async () => {
    await executeWithAuth(async () => {
      try {
        setLoading(true);
        
        // Verificar estado del sistema primero
        const systemStatus = await leagueApi.getSystemStatus();
        
        if (systemStatus.isInitialized && systemStatus.hasAssignments) {
          message.info('El sistema ya está inicializado y tiene asignaciones. Se verificará la estructura.');
        }
        
        // Inicializar sistema (idempotente)
        const initResult = await leagueApi.initializeLeagueSystem();
        
        if (initResult.isNewSystem) {
          message.success('Sistema de ligas inicializado correctamente');
        } else {
          message.info(`Sistema ya inicializado. Asignaciones existentes: ${initResult.existingAssignments || 0}`);
        }
        
        // Obtener o crear temporada
        let currentSeason: any = null;
        
        try {
          currentSeason = await leagueApi.getActiveSeason();
          message.info(`Usando temporada existente: ${currentSeason.name}`);
        } catch (error) {
          // Crear temporada si no existe
          const currentYear = new Date().getFullYear();
          currentSeason = await leagueApi.createSeason({
            name: `Temporada ${currentYear}-${String(currentYear + 1).slice(2)}`,
            year: currentYear,
            isActive: true
          });
          message.success('Temporada creada correctamente');
        }
        
        // Verificar si ya hay asignaciones para esta temporada
        const assignmentStatus = await leagueApi.getAssignmentStatus(currentSeason.id);
        
        if (assignmentStatus.hasAssignments) {
          message.info('Ya hay equipos asignados en esta temporada.');
        } else {
          // Asignar equipos solo si no hay asignaciones
          const assignResult = await leagueApi.assignTeamsByTikTokFollowers(currentSeason.id);
          
          if (assignResult.assignedTeams > 0) {
            message.success(`${assignResult.assignedTeams} equipos asignados a divisiones según seguidores de TikTok`);
          } else {
            message.info('Todos los equipos ya estaban asignados');
          }
        }
        
        // Recargar datos
        await loadInitialData();
        
      } catch (error) {
        console.error('Error inicializando sistema:', error);
        if (error instanceof Error && error.message.includes('401')) {
          message.error('Sesión expirada. Por favor, inicia sesión nuevamente.');
          authApi.logout();
        } else {
          message.error('Error inicializando el sistema de ligas');
        }
      } finally {
        setLoading(false);
      }
    });
  };

  const handleResetSystem = async () => {
    await executeWithAuth(async () => {
      if (!confirm('⚠️ PELIGRO: Esto eliminará TODAS las divisiones, ligas y asignaciones. ¿Estás seguro?')) {
        return;
      }
      
      try {
        setLoading(true);
        
        const resetResult = await leagueApi.resetLeagueSystem();
        message.warning(resetResult.warning);
        message.info(resetResult.message);
        
        // Limpiar estado local
        setDivisions([]);
        setSelectedDivision(null);
        setSelectedLeague(null);
        setTeams([]);
        setSeason(null);
        setSystemInitialized(false);
        
      } catch (error) {
        console.error('Error reseteando sistema:', error);
        if (error instanceof Error && error.message.includes('401')) {
          message.error('Sesión expirada. Por favor, inicia sesión nuevamente.');
          authApi.logout();
        } else {
          message.error('Error reseteando el sistema de ligas');
        }
      } finally {
        setLoading(false);
      }
    });
  };

  const handleDivisionChange = (divisionLevel: number) => {
    const division = divisions.find(d => d.level === divisionLevel);
    if (division) {
      setSelectedDivision(division);
      if (division.leagues.length > 0) {
        setSelectedLeague(division.leagues[0].id);
      } else {
        setSelectedLeague(null);
        setTeams([]);
      }
    }
  };

  const handleLeagueChange = (leagueId: number) => {
    setSelectedLeague(leagueId);
  };

  // Efectos
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedLeague && season) {
      loadTeamsInLeague(selectedLeague, season.id);
    }
  }, [selectedLeague, season]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!systemInitialized) {
    return (
      <div style={{ padding: '20px' }}>
        {/* Header superior con autenticación */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px',
          padding: '12px 16px',
          backgroundColor: '#fafafa',
          borderRadius: '6px',
          border: '1px solid #e0e0e0'
        }}>
          <div>
            <Text strong style={{ fontSize: '16px' }}>⚽ Sistema de Ligas FoodBall</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>Panel de Administración</Text>
          </div>
          <AuthStatus size="small" />
        </div>

        <div style={{ textAlign: 'center' }}>
          <Alert
            message="Sistema de Ligas no Inicializado"
            description="El sistema de ligas aún no ha sido configurado. Haz clic en el botón para inicializar la estructura de divisiones y asignar equipos."
            type="info"
            style={{ marginBottom: '20px' }}
          />
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Button type="primary" size="large" onClick={handleInitializeSystem}>
              Inicializar Sistema de Ligas
            </Button>
            {import.meta.env.DEV && (
              <Button type="default" danger onClick={handleResetSystem}>
                🔄 Reset Sistema (Dev)
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!season) {
    return (
      <div style={{ padding: '20px' }}>
        {/* Header superior con autenticación */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px',
          padding: '12px 16px',
          backgroundColor: '#fafafa',
          borderRadius: '6px',
          border: '1px solid #e0e0e0'
        }}>
          <div>
            <Text strong style={{ fontSize: '16px' }}>⚽ Sistema de Ligas FoodBall</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>Panel de Administración</Text>
          </div>
          <AuthStatus size="small" />
        </div>

        <Alert
          message="No hay temporada activa"
          description="No se encontró una temporada activa en el sistema."
          type="warning"
        />
      </div>
    );
  }

  const selectedLeagueData = selectedDivision?.leagues.find(l => l.id === selectedLeague);

  return (
    <div style={{ padding: '20px' }}>
      {/* Header superior con autenticación */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '16px',
        padding: '12px 16px',
        backgroundColor: '#fafafa',
        borderRadius: '6px',
        border: '1px solid #e0e0e0'
      }}>
        <div>
          <Text strong style={{ fontSize: '16px' }}>⚽ Sistema de Ligas FoodBall</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>Panel de Administración</Text>
        </div>
        <AuthStatus size="small" />
      </div>

      {/* Header con información de la temporada */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>Sistema de Ligas - {season.name}</Title>
        <Text type="secondary">
          Equipos organizados por divisiones según popularidad en TikTok
        </Text>
        {import.meta.env.DEV && (
          <div style={{ marginTop: '8px' }}>
            <Button type="text" danger size="small" onClick={handleResetSystem}>
              🔄 Reset Sistema (Solo Desarrollo)
            </Button>
          </div>
        )}
      </div>

      {/* Selectores de División y Liga */}
      <Card style={{ marginBottom: '24px' }}>
        <div className="division-controls">
          <div>
            <Text strong style={{ marginRight: '8px' }}>División:</Text>
            <Select
              value={selectedDivision?.level}
              onChange={handleDivisionChange}
              style={{ width: 200 }}
              placeholder="Seleccionar división"
            >
              {divisions.map(division => (
                <Option key={division.level} value={division.level}>
                  {division.name} (Nivel {division.level})
                </Option>
              ))}
            </Select>
          </div>

          {selectedDivision && selectedDivision.leagues.length > 1 && (
            <div>
              <Text strong style={{ marginRight: '8px' }}>Liga:</Text>
              <Select
                value={selectedLeague}
                onChange={handleLeagueChange}
                style={{ width: 200 }}
                placeholder="Seleccionar liga"
              >
                {selectedDivision.leagues.map(league => (
                  <Option key={league.id} value={league.id}>
                    Grupo {league.groupCode}
                  </Option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {/* Información de la división seleccionada */}
        {selectedDivision && (
          <div className="division-info-card">
            <Text strong>{selectedDivision.name}</Text>
            {selectedDivision.description && (
              <div><Text type="secondary">{selectedDivision.description}</Text></div>
            )}
            <div className="division-tags">
              {selectedDivision.europeanSlots > 0 && (
                <Tag color="gold">🏆 {selectedDivision.europeanSlots} plazas europeas</Tag>
              )}
              {selectedDivision.promoteSlots > 0 && (
                <Tag color="green">↑ {selectedDivision.promoteSlots} ascensos directos</Tag>
              )}
              {selectedDivision.promotePlayoffSlots > 0 && (
                <Tag color="orange">⚡ {selectedDivision.promotePlayoffSlots} playoff ascenso</Tag>
              )}
              {selectedDivision.relegateSlots > 0 && (
                <Tag color="red">↓ {selectedDivision.relegateSlots} descensos</Tag>
              )}
              <Tag color="blue">👥 {selectedDivision.teamsPerLeague} equipos por liga</Tag>
              <Tag color="purple">🏟️ {selectedDivision.totalLeagues} liga{selectedDivision.totalLeagues > 1 ? 's' : ''}</Tag>
            </div>
          </div>
        )}
      </Card>

      {/* Tabla de equipos */}
      {selectedLeagueData && (
        <Card 
          title={`${selectedLeagueData.name} - ${teams.length} equipos`}
          extra={
            <Text type="secondary">
              Temporada {season.name}
            </Text>
          }
        >
          <Table
            columns={createColumns(selectedDivision, navigate)}
            dataSource={teams}
            rowKey="teamId"
            loading={teamsLoading}
            pagination={false}
            size="middle"
            scroll={{ x: 800 }}
            rowClassName={(record: ExtendedTeamInLeague) => {
              if (!selectedDivision || !record.position) return '';
              
              const status = getTeamStatus(record.position, selectedDivision, teams.length);
              return `team-row-${status.status}`;
            }}
            onRow={(record: ExtendedTeamInLeague) => ({
              style: (() => {
                if (!selectedDivision || !record.position) return {};
                
                const status = getTeamStatus(record.position, selectedDivision, teams.length);
                return {
                  backgroundColor: status.backgroundColor,
                  borderLeft: `4px solid ${status.color}`
                };
              })()
            })}
          />
          
          {/* Leyenda de colores */}
          {selectedDivision && (
            <div className="division-legend">
              <Text strong style={{ marginBottom: '8px', display: 'block' }}>Leyenda de Clasificación:</Text>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {selectedDivision.level === 1 && selectedDivision.europeanSlots > 0 && (
                  <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#e6f7ff', border: '2px solid #1890ff' }}></div>
                    <Text style={{ fontSize: '12px' }}>🏆 Competiciones Europeas (Pos. 1-{selectedDivision.europeanSlots})</Text>
                  </div>
                )}
                {selectedDivision.level > 1 && selectedDivision.promoteSlots > 0 && (
                  <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#f6ffed', border: '2px solid #52c41a' }}></div>
                    <Text style={{ fontSize: '12px' }}>⬆️ Ascenso Directo (Pos. 1-{selectedDivision.promoteSlots})</Text>
                  </div>
                )}
                {selectedDivision.level > 1 && selectedDivision.promotePlayoffSlots > 0 && (
                  <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#fff7e6', border: '2px solid #fa8c16' }}></div>
                    <Text style={{ fontSize: '12px' }}>🎯 Playoff Ascenso (Pos. {selectedDivision.promoteSlots + 1}-{selectedDivision.promoteSlots + selectedDivision.promotePlayoffSlots})</Text>
                  </div>
                )}
                {selectedDivision.relegateSlots > 0 && (
                  <div className="legend-item">
                    <div className="legend-color" style={{ backgroundColor: '#fff2f0', border: '2px solid #ff4d4f' }}></div>
                    <Text style={{ fontSize: '12px' }}>⬇️ Descenso (Pos. {teams.length - selectedDivision.relegateSlots + 1}-{teams.length})</Text>
                  </div>
                )}
                <div className="legend-item">
                  <div className="legend-color" style={{ backgroundColor: '#ffffff', border: '2px solid #8c8c8c' }}></div>
                  <Text style={{ fontSize: '12px' }}>✓ Posición Segura</Text>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {!selectedLeague && selectedDivision && (
        <Alert
          message="Selecciona una liga"
          description="Selecciona una liga para ver los equipos asignados."
          type="info"
        />
      )}

      {/* Modal de Login para operaciones administrativas */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          setPendingAdminAction(null);
        }}
        onLogin={handleLoginSuccess}
      />
    </div>
  );
}
