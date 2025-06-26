import { useState, useEffect } from 'react';
import { Table, Select, Spin, Alert, Typography, Card, Tag, Button, message, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';
import { leagueApi } from '../../api/leagueApi';
import type { Division, Season, TeamInLeague } from '../../types/league.types';
import type { ColumnsType } from 'antd/es/table';
import '../../styles/DivisionView.css';

const { Title, Text } = Typography;
const { Option } = Select;

interface ExtendedTeamInLeague extends TeamInLeague {
  position?: number;
}

// Función para determinar el estado de clasificación de un equipo
const getTeamStatus = (
  position: number, 
  division: Division, 
  totalTeamsInLeague: number
): { status: string; color: string; badge: string; backgroundColor: string } => {
  // Plazas europeas (solo División 1)
  if (division.level === 1 && position <= division.europeanSlots) {
    return {
      status: 'european',
      color: '#1890ff',
      badge: '🏆 Europa',
      backgroundColor: '#e6f7ff'
    };
  }

  // Ascenso directo
  if (division.level > 1 && position <= division.promoteSlots) {
    return {
      status: 'promotion',
      color: '#52c41a',
      badge: '⬆️ Asciende',
      backgroundColor: '#f6ffed'
    };
  }

  // Playoff de ascenso
  if (division.level > 1 && 
      position > division.promoteSlots && 
      position <= (division.promoteSlots + division.promotePlayoffSlots)) {
    return {
      status: 'playoff',
      color: '#fa8c16',
      badge: '🎯 Playoff',
      backgroundColor: '#fff7e6'
    };
  }

  // Descenso
  if (division.relegateSlots > 0 && 
      position > (totalTeamsInLeague - division.relegateSlots)) {
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

function formatNumber(num?: number) {
  if (!num || num === 0) return '0';
  
  if (num >= 1000000000) {
    const billions = num / 1000000000;
    return (billions % 1 === 0 ? billions.toFixed(0) : billions.toFixed(1)) + 'B';
  } else if (num >= 1000000) {
    const millions = num / 1000000;
    return (millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)) + 'M';
  } else if (num >= 1000) {
    const thousands = num / 1000;
    return (thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)) + 'K';
  }
  return num.toString();
}

const getAssignmentReasonText = (reason: number) => {
  switch (reason) {
    case 0: return { text: 'TikTok', color: 'blue' };
    case 1: return { text: 'Ascenso', color: 'green' };
    case 2: return { text: 'Descenso', color: 'red' };
    case 3: return { text: 'Playoff', color: 'orange' };
    case 4: return { text: 'Disponibilidad', color: 'purple' };
    default: return { text: 'Desconocido', color: 'default' };
  }
};

// Función para crear las columnas dinámicamente según la división
const createColumns = (selectedDivision: Division | null, navigate: any): ColumnsType<ExtendedTeamInLeague> => [
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
          onClick={() => navigate(`/team/${record.teamId}`)}
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
          onClick={() => navigate(`/team/${record.teamId}`)}
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

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, []);

  // Cargar equipos cuando cambia la liga seleccionada
  useEffect(() => {
    if (selectedLeague && season) {
      loadTeamsInLeague(selectedLeague, season.id);
    }
  }, [selectedLeague, season]);

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
    try {
      setLoading(true);
      
      // Inicializar sistema
      await leagueApi.initializeLeagueSystem();
      message.success('Sistema de ligas inicializado correctamente');
      
      // Crear temporada inicial
      const currentYear = new Date().getFullYear();
      const newSeason = await leagueApi.createSeason({
        name: `Temporada ${currentYear}-${String(currentYear + 1).slice(2)}`,
        year: currentYear,
        isActive: true
      });
      
      message.success('Temporada creada correctamente');
      
      // Asignar equipos
      await leagueApi.assignTeamsByTikTokFollowers(newSeason.id);
      message.success('Equipos asignados a divisiones según seguidores de TikTok');
      
      // Recargar datos
      await loadInitialData();
      
    } catch (error) {
      console.error('Error inicializando sistema:', error);
      message.error('Error inicializando el sistema de ligas');
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!systemInitialized) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Alert
          message="Sistema de Ligas no Inicializado"
          description="El sistema de ligas aún no ha sido configurado. Haz clic en el botón para inicializar la estructura de divisiones y asignar equipos."
          type="info"
          style={{ marginBottom: '20px' }}
        />
        <Button type="primary" size="large" onClick={handleInitializeSystem}>
          Inicializar Sistema de Ligas
        </Button>
      </div>
    );
  }

  if (!season) {
    return (
      <Alert
        message="No hay temporada activa"
        description="No se encontró una temporada activa en el sistema."
        type="warning"
      />
    );
  }

  const selectedLeagueData = selectedDivision?.leagues.find(l => l.id === selectedLeague);

  return (
    <div style={{ padding: '20px' }}>
      {/* Header con información de la temporada */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>Sistema de Ligas - {season.name}</Title>
        <Text type="secondary">
          Equipos organizados por divisiones según popularidad en TikTok
        </Text>
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
              <Tag color="purple">�️ {selectedDivision.totalLeagues} liga{selectedDivision.totalLeagues > 1 ? 's' : ''}</Tag>
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
    </div>
  );
}
