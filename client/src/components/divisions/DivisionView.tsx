import { Table, Select, Alert, Typography, Card, Tag, Popover } from 'antd';
import LoadingBallAnimation from '../LoadingBallAnimation';
import { useNavigate } from 'react-router-dom';
import { leagueApi } from '../../api/leagueApi';
import { matchApi } from '../../api/matchApi';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { Division, Season } from '../../types/league.types';
import type { TeamCommon } from '../../types/team.types';
import type { ColumnsType } from 'antd/es/table';
import { formatNumber } from '../../utils/formatters';
import '../../styles/common.css';
import '../../styles/DivisionView.css';
import TeamCrestSvg from '../TeamCrestSvg';

// Explicaciones para los estados de la tabla
const statusExplanations: Record<string, string> = {
  PROMOTES: 'El equipo asciende de división por su posición en la tabla.',
  PLAYOFF: 'El equipo jugará un playoff para intentar ascender de división.',
  RELEGATES: 'El equipo desciende de división por su posición en la tabla.',
  TOURNAMENT: 'El equipo obtiene plaza para el torneo especial de la temporada.',
  SAFE: 'El equipo mantiene la categoría, sin ascenso ni descenso.',
};

const { Text } = Typography;
const { Option } = Select;

// Función para obtener el diseño visual de cada estado
const getStatusDisplay = (status: string): { color: string; badge: string; backgroundColor: string } => {
  switch (status) {
    case 'PROMOTES':
      return {
        color: '#52c41a',
        badge: '⬆️ Ascenso',
        backgroundColor: '#f6ffed'
      };
    case 'PLAYOFF':
      return {
        color: '#fa8c16',
        badge: '🎯 Playoff',
        backgroundColor: '#fff7e6'
      };
    case 'RELEGATES':
      return {
        color: '#ff4d4f',
        badge: '⬇️ Descenso',
        backgroundColor: '#fff2f0'
      };
    case 'TOURNAMENT':
      return {
        color: '#722ed1',
        badge: '🏆 Torneo',
        backgroundColor: '#f9f0ff'
      };
    case 'SAFE':
    default:
      return {
        color: '#8c8c8c',
        badge: '✓ Seguro',
        backgroundColor: '#ffffff'
      };
  }
};

// Función para crear las columnas dinámicamente (optimizada con memoización)
const createColumns = (navigate: any): ColumnsType<ExtendedTeamInLeague> => {
  const handleTeamClick = (teamId: number) => navigate(`/team/${teamId}`);
  
  return [
    {
      title: 'Pos.',
      dataIndex: 'position',
      key: 'position',
      width: 38,
      render: (position: number, record: ExtendedTeamInLeague) => {
        const backendStatus = (record.standing as any)?.status;
        const statusDisplay = backendStatus ? getStatusDisplay(backendStatus) : null;
        const posValue = record.standing?.position || position || '-';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontWeight: 500, fontSize: 16, width: 28, minWidth: 28, maxWidth: 28, textAlign: 'center', display: 'inline-block', letterSpacing: '1px' }}>{posValue}</span>
            {statusDisplay && (
              <Popover
                content={statusExplanations[backendStatus] || 'Sin información'}
                title={statusDisplay.badge.replace(/^[^\w]+/, '')}
                trigger="click"
                overlayInnerStyle={{ background: '#222', color: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0008', fontSize: 15, fontWeight: 500, padding: 14 }}
                overlayClassName="dark-popover"
              >
                <Tag color={statusDisplay.color} style={{
                  margin: 0,
                  minWidth: window.innerWidth <= 640 ? 28 : 75,
                  maxWidth: window.innerWidth <= 640 ? 28 : 75,
                  width: window.innerWidth <= 640 ? 28 : 75,
                  minHeight: window.innerWidth <= 640 ? 28 : undefined,
                  height: window.innerWidth <= 640 ? 28 : undefined,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  fontSize: window.innerWidth <= 640 ? 18 : 12,
                  borderRadius: window.innerWidth <= 640 ? 6 : undefined,
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  textAlign: 'center',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}>
                  {window.innerWidth <= 640
                    ? (() => {
                        // Extraer emoji, si no existe, usar alternativa
                        const match = statusDisplay.badge.match(/^([\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}-\u{2454}\u{20D0}-\u{20FF}]+)\s?/u);
                        if (match && match[1]) return match[1];
                        // Alternativas unicode si el emoji no se detecta
                        if (backendStatus === 'PROMOTES') return '\u2191'; // ↑
                        if (backendStatus === 'RELEGATES') return '\u2193'; // ↓
                        if (backendStatus === 'PLAYOFF') return '\u25B6'; // ▶
                        if (backendStatus === 'TOURNAMENT') return '\u2605'; // ★
                        if (backendStatus === 'SAFE') return '\u2713'; // ✓
                        return '';
                      })()
                    : statusDisplay.badge}
                </Tag>
              </Popover>
            )}
          </div>
        );
      },
    },
    {
      title: 'Equipo',
      key: 'team',
      width: 180,
      render: (_: any, record: ExtendedTeamInLeague) => (
        <div
          className="clickable-team"
          onClick={() => handleTeamClick(record.teamId)}
          style={{ display: 'flex', alignItems: 'center', minWidth: 180 }}
        >
          <span style={{ display: 'flex', alignItems: 'center', marginRight: 10 }}>
            {record.crest ? (
              <img
                src={record.crest}
                alt={record.teamName}
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <TeamCrestSvg
                size={32}
                teamId={record.teamId}
                primaryColor={record.primaryColor}
                secondaryColor={record.secondaryColor}
                name={record.teamName}
              />
            )}
          </span>
          <span className="clickable-team-name" style={{ fontWeight: 500 }}>{record.teamName}</span>
          {record.shortName && record.shortName !== record.teamName && (
            <span style={{ marginLeft: 6, color: '#888', fontSize: 13 }}>({record.shortName})</span>
          )}
        </div>
      )
    },
    { 
      title: 'PJ', 
      key: 'matchesPlayed',
      width: 60,
      render: (_, record: ExtendedTeamInLeague) => record.standing?.played || 0
    },
    { 
      title: 'PTS', 
      key: 'points',
      width: 70,
      sorter: (a, b) => (b.standing?.points || 0) - (a.standing?.points || 0),
      render: (_, record: ExtendedTeamInLeague) => (
        <Text strong style={{ color: '#1890ff' }}>{record.standing?.points || 0}</Text>
      )
    },
    { 
      title: 'G', 
      key: 'wins',
      width: 50,
      render: (_, record: ExtendedTeamInLeague) => record.standing?.won || 0
    },
    { 
      title: 'E', 
      key: 'draws',
      width: 50,
      render: (_, record: ExtendedTeamInLeague) => record.standing?.drawn || 0
    },
    { 
      title: 'P', 
      key: 'losses',
      width: 50,
      render: (_, record: ExtendedTeamInLeague) => record.standing?.lost || 0
    },
    { 
      title: 'GF', 
      key: 'goalsFor',
      width: 60,
      render: (_, record: ExtendedTeamInLeague) => record.standing?.goalsFor || 0
    },
    { 
      title: 'GC', 
      key: 'goalsAgainst',
      width: 60,
      render: (_, record: ExtendedTeamInLeague) => record.standing?.goalsAgainst || 0
    },
    { 
      title: 'DG', 
      key: 'goalDifference',
      width: 70,
      sorter: (a, b) => (b.standing?.goalDifference || 0) - (a.standing?.goalDifference || 0),
      render: (_, record: ExtendedTeamInLeague) => {
        const diff = record.standing?.goalDifference || 0;
        return (
          <Text style={{ color: diff > 0 ? '#52c41a' : diff < 0 ? '#ff4d4f' : '#8c8c8c' }}>
            {diff > 0 ? '+' : ''}{diff}
          </Text>
        );
      }
    },
    { 
      title: 'Seguidores', 
      dataIndex: 'tiktokFollowers', 
      key: 'tiktokFollowers', 
      sorter: (a, b) => b.tiktokFollowers - a.tiktokFollowers,
      render: (followers: number) => formatNumber(followers)
    },
  ];
};

interface ExtendedTeamInLeague extends TeamCommon {
  teamId: number;
  teamName: string;
  tiktokFollowers: number;
  followersAtAssignment: number;
  standing?: any;
  position?: number;
  // ...otros campos específicos...
}

export default function DivisionView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [teams, setTeams] = useState<ExtendedTeamInLeague[]>([]);
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [systemInitialized, setSystemInitialized] = useState(false);
  const [searchParams] = useSearchParams();
  // teamId del usuario logueado
  const loggedTeamId = user?.teamId;

  // Cargar datos iniciales, soportando teamId en la query string
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
          let foundDivision = null;
          let foundLeague = null;

          // Buscar teamId en la query string
          const teamIdParam = searchParams.get('teamId');
          const teamId = teamIdParam ? parseInt(teamIdParam, 10) : user?.teamId;

          if (teamId && activeSeason) {
            outer: for (const division of divisionStructure) {
              for (const league of division.leagues) {
                try {
                  // eslint-disable-next-line no-await-in-loop
                  const teamsInLeague = await leagueApi.getTeamsInLeague(league.id, activeSeason.id);
                  if (teamsInLeague.some(t => t.teamId === teamId)) {
                    foundDivision = division;
                    foundLeague = league;
                    break outer;
                  }
                } catch (e) {
                  // Si falla, ignorar y seguir buscando
                }
              }
            }
          }

          // Si se encontró la liga del equipo, seleccionarla; si no, División 1 por defecto
          const divisionToSelect = foundDivision || divisionStructure.find(d => d.level === 1) || divisionStructure[0];
          setSelectedDivision(divisionToSelect);
          if (foundLeague) {
            setSelectedLeague(foundLeague.id);
          } else if (divisionToSelect.leagues.length > 0) {
            setSelectedLeague(divisionToSelect.leagues[0].id);
          }
          setSystemInitialized(true);
        }
      } catch (error) {
        console.log('Sistema de ligas no inicializado');
        setSystemInitialized(false);
      }

    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
      // message.error('Error cargando los datos del sistema de ligas');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamsInLeague = async (leagueId: number, seasonId: number) => {
    try {
      setTeamsLoading(true);
      
      // Cargar equipos y clasificaciones en paralelo
      const [teamsData, standingsData] = await Promise.all([
        leagueApi.getTeamsInLeague(leagueId, seasonId),
        matchApi.getLeagueStandings(leagueId, seasonId).catch((error) => {
          console.error('Error cargando clasificaciones:', error);
          return [];
        })
      ]);
      
      // Crear mapa de clasificaciones para acceso rápido
      const standingsMap = new Map(standingsData.map(s => [
        (s as any).team?.id || s.teamId, 
        s
      ]));
      
      // Combinar datos de equipos con clasificaciones
      const teamsWithStandings = teamsData.map(team => {
        const standing = standingsMap.get(team.teamId);
        return {
          ...team,
          standing,
          position: standing?.position || undefined
        };
      });
      
      // Ordenar por la posición que ya viene de la API (que incluye la lógica de desempate correcta)
      const sortedTeams = teamsWithStandings.sort((a, b) => {
        if (a.standing && b.standing) {
          // Usar la posición que ya viene calculada desde la API con la lógica de desempate
          return (a.standing.position || 999) - (b.standing.position || 999);
        }
        // Si no hay clasificaciones, ordenar por seguidores al asignar
        return b.followersAtAssignment - a.followersAtAssignment;
      });
      
      // Mantener las posiciones que vienen de la API y asegurar todos los campos de ExtendedTeamInLeague
      const finalTeams: ExtendedTeamInLeague[] = sortedTeams.map((team, index) => ({
        ...team,
        teamId: team.teamId,
        teamName: team.teamName,
        tiktokFollowers: team.tiktokFollowers ?? 0,
        followersAtAssignment: team.followersAtAssignment ?? 0,
        standing: team.standing,
        position: team.standing?.position || index + 1,
        // TeamCommon fields
        id: team.teamId,
        name: team.teamName,
        crest: team.crest ?? '',
        shortName: team.shortName ?? '',
      }));
      setTeams(finalTeams);
    } catch (error) {
      console.error('Error cargando equipos:', error);
      // message.error('Error cargando los equipos de la liga');
      setTeams([]);
    } finally {
      setTeamsLoading(false);
    }
  };

  // Restaurar selectores de división y liga
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
    return <LoadingBallAnimation text="Cargando datos de la división..." />;
  }

  if (!systemInitialized) {
    return (
      <div style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Alert
            message="Sistema de Ligas no Inicializado"
            description="El sistema de ligas aún no ha sido configurado. Solicita a un administrador que lo inicialice desde su cuenta."
            type="info"
            style={{ marginBottom: 0 }}
          />
        </div>
      </div>
    );
  }

  if (!season) {
    return (
      <div style={{ width: '100%' }}>
        <Alert
          message="No hay temporada activa"
          description="No se encontró una temporada activa en el sistema."
          type="warning"
          style={{ marginBottom: 0 }}
        />
      </div>
    );
  }

  const selectedLeagueData = selectedDivision?.leagues.find(l => l.id === selectedLeague);

  return (
    <div style={{ width: '100%', padding: '0 0 0 0' }}>
      {/* Cabecera visual destacada */}
      {selectedLeagueData && (
        <div style={{
          width: '100%',
          background: 'linear-gradient(90deg, #e0e7ff 0%, #fff 100%)',
          padding: '10px 0',
          marginBottom: 0,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8
        }}>
          <div style={{ fontWeight: 700, fontSize: 24, color: '#3b3b3b', letterSpacing: 1, marginBottom: 0 }}>
            {selectedDivision?.description || selectedDivision?.name || 'División'}
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <Select
                value={selectedDivision?.level}
                onChange={handleDivisionChange}
                style={{ minWidth: 160, maxWidth: 220, fontWeight: 600, fontSize: 16, borderRadius: 8, border: '2px solid #a5b4fc', background: '#fff' }}
                placeholder="Seleccionar división"
              >
                {divisions.map(division => (
                  <Option key={division.level} value={division.level}>
                    {division.description || division.name}
                  </Option>
                ))}
              </Select>
            </div>
            {selectedDivision && selectedDivision.leagues.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <Select
                  value={selectedLeague}
                  onChange={handleLeagueChange}
                  style={{ minWidth: 160, maxWidth: 220, fontWeight: 600, fontSize: 16, borderRadius: 8, border: '2px solid #a5b4fc', background: '#fff' }}
                  placeholder="Seleccionar grupo"
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
        </div>
      )}

      {/* Tabla de equipos */}
      {selectedLeagueData && (
        <Card style={{ marginTop: 0, width: '100%' }} styles={{ body: { width: '100%' } }}>
          <Table
            columns={createColumns(navigate)}
            dataSource={teams}
            rowKey="teamId"
            loading={teamsLoading}
            pagination={false}
            size="middle"
            scroll={{ x: '100%' }}
            style={{ width: '100%' }}
            rowClassName={(record: ExtendedTeamInLeague) => {
              const backendStatus = (record.standing as any)?.status;
              let rowClass = '';
              if (backendStatus) rowClass = `team-row-${backendStatus.toLowerCase()}`;
              if (loggedTeamId && record.teamId === loggedTeamId) rowClass += ' team-row-logged';
              return rowClass.trim();
            }}
            onRow={(record: ExtendedTeamInLeague) => ({
              style: (() => {
                const backendStatus = (record.standing as any)?.status;
                let style: React.CSSProperties = {};
                if (backendStatus) {
                  const statusDisplay = getStatusDisplay(backendStatus);
                  style.backgroundColor = statusDisplay.backgroundColor;
                  style.borderLeft = `4px solid ${statusDisplay.color}`;
                }
                // El sombreado real se aplica por CSS en .team-row-logged
                return style;
              })()
            })}
          />
          {/* Etiquetas informativas de la liga debajo de la tabla */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, width: '100%', marginTop: 0,padding: '15px 0' }}>
            {selectedDivision && (
              <Tag color="blue">{teams.length} / {selectedDivision.teamsPerLeague} equipos</Tag>
            )}
            {/* El tag de "Tu equipo" se elimina porque ya se resalta la fila */}
            <Tag color="purple">{season.name}</Tag>
            {selectedDivision && selectedDivision.level === 1 && (
              <Tag color="purple">🏆 8 plazas de torneo</Tag>
            )}
            {selectedDivision && selectedDivision.promoteSlots > 0 && (
              <Tag color="green">↑ {selectedDivision.promoteSlots} ascensos directos</Tag>
            )}
            {selectedDivision && selectedDivision.promotePlayoffSlots > 0 && (
              <Tag color="orange">⚡ {selectedDivision.promotePlayoffSlots} playoff ascenso</Tag>
            )}
            {selectedDivision && selectedDivision.relegateSlots > 0 && (
              <Tag color="red">↓ {selectedDivision.relegateSlots} descensos</Tag>
            )}
            {selectedDivision && (
              <Tag color="purple">🏟️ {selectedDivision.totalLeagues} liga{selectedDivision.totalLeagues > 1 ? 's' : ''}</Tag>
            )}
          </div>
        </Card>
      )}

      {!selectedLeague && selectedDivision && (
        <Alert
          message="Selecciona una liga"
          description="Selecciona una liga para ver los equipos asignados."
          type="info"
          style={{ marginTop: 0, marginBottom: 0 }}
        />
      )}
    </div>
  );
}
