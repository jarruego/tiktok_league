import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, Table, Select, message, Space } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import { LayoutContainer } from '../components/LayoutContainer';
import LoadingBallAnimation from '../components/LoadingBallAnimation';
import { matchApi } from '../api/matchApi';
import { leagueApi } from '../api/leagueApi';
import dayjs from 'dayjs';
import type { Match, MatchFilters } from '../types/match.types';
import type { Division } from '../types/league.types';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;



export default function MatchesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [filters, setFilters] = useState<MatchFilters>({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 100,
    total: 0
  });
  const [stats, setStats] = useState({
    totalMatches: 0,
    scheduledMatches: 0,
    finishedMatches: 0,
    totalMatchdays: 0,
    leaguesCount: 0,
    playoffMatches: 0,
    regularMatches: 0
  });

  // --- Mover funciones aquí antes de los useEffect ---
  const loadInitialData = async () => {
    try {
      const [seasonsData, divisionsData] = await Promise.all([
        leagueApi.getAllSeasons(),
        leagueApi.getDivisionStructure()
      ]);
      setDivisions(divisionsData);
      // Seleccionar temporada activa por defecto
      const activeSeason = seasonsData.find(s => s.isActive);
      if (activeSeason) {
        setSelectedSeason(activeSeason.id);
        // Si el usuario tiene equipo, buscar su división y liga
        if (user && user.teamId) {
          // Buscar la liga y división del equipo
          let foundLeague = null;
          let foundDivision = null;
          for (const division of divisionsData) {
            for (const league of division.leagues) {
              // Buscar el equipo en la liga
              const teams = await leagueApi.getTeamsInLeague(league.id, activeSeason.id);
              if (teams.some(t => t.teamId === user.teamId)) {
                foundLeague = league;
                foundDivision = division;
                break;
              }
            }
            if (foundLeague && foundDivision) break;
          }
          if (foundLeague && foundDivision) {
            // Obtener partidos de esa liga para la temporada
            const matchesResp = await matchApi.getMatchesBySeason(activeSeason.id, { leagueId: foundLeague.id });
            // Buscar la próxima jornada con partidos programados o en vivo
            const nextMatch = matchesResp.matches.find(m => m.status === 'scheduled' || m.status === 'live');
            const nextMatchday = nextMatch ? nextMatch.matchday : undefined;
            setFilters({
              divisionId: foundDivision.id,
              leagueId: foundLeague.id,
              matchday: nextMatchday
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      message.error('Error cargando datos iniciales');
    }
  };

  const loadMatches = async () => {
    if (!selectedSeason) return;
    try {
      setLoading(true);
      const response = await matchApi.getMatchesBySeason(selectedSeason, {
        ...filters,
        page: pagination.current,
        limit: pagination.pageSize
      });
      setMatches(response.matches);
      setPagination(prev => ({
        ...prev,
        total: response.pagination.total
      }));
    } catch (error) {
      console.error('Error loading matches:', error);
      message.error('Error cargando partidos');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!selectedSeason) return;
    try {
      const seasonStats = await matchApi.getSeasonStats(selectedSeason);
      // Calcular estadísticas de playoffs desde los matches actuales
      const playoffMatches = matches.filter(m => m.isPlayoff).length;
      const regularMatches = matches.filter(m => !m.isPlayoff).length;
      setStats({
        ...seasonStats,
        playoffMatches,
        regularMatches
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };


  // --- useEffect después de las funciones ---
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      loadMatches();
      loadStats();
    }
  }, [selectedSeason, filters, pagination.current, pagination.pageSize]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
    // Recargar partidos desde la primera página al cambiar filtros
    if (selectedSeason) {
      loadMatches();
    }
  }, [filters]);

  // Mostrar animación de carga solo antes del return principal
  if (loading) {
    return <LoadingBallAnimation text="Cargando partidos..." />;
  }


  const columns: ColumnsType<Match> = [
    {
      title: 'J.',
      dataIndex: 'matchday',
      key: 'matchday',
      width: 50,
      render: (matchday: number, record) => {
        if (record.isPlayoff) {
          return (
            <span style={{ color: '#d72660', fontWeight: 700 }}>PO</span>
          );
        }
        return matchday;
      },
      sorter: (a, b) => a.matchday - b.matchday,
      responsive: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    {
      title: 'Fecha',
      dataIndex: 'scheduledDate',
      key: 'scheduledDate',
      width: 100,
      render: (date: string) => dayjs(date).format('DD/MM'),
      sorter: (a, b) => dayjs(a.scheduledDate).unix() - dayjs(b.scheduledDate).unix(),
      responsive: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    {
      title: 'Partido',
      key: 'partido',
      align: 'left',
      render: (_, record) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
          gap: 4,
          width: '100%'
        }}>
          {/* Local */}
          {record.homeTeam.crest && (
            <img
              src={record.homeTeam.crest}
              alt=""
              style={{ width: 18, height: 18, marginRight: 2, verticalAlign: 'middle' }}
            />
          )}
          <span style={{ fontWeight: 500, fontSize: 13, color: '#1e90ff', maxWidth: 80, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {record.homeTeam.shortName || record.homeTeam.name}
          </span>
          {/* Resultado */}
          <span style={{ fontWeight: 700, fontSize: 15, margin: '0 6px', minWidth: 36, textAlign: 'center', color: '#222', display: 'inline-block' }}>
            {record.homeGoals !== null && record.awayGoals !== null
              ? `${record.homeGoals} - ${record.awayGoals}`
              : <span style={{ color: '#999', fontWeight: 400 }}>vs</span>}
          </span>
          {/* Visitante */}
          <span style={{ fontWeight: 500, fontSize: 13, color: '#d72660', maxWidth: 80, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {record.awayTeam.shortName || record.awayTeam.name}
          </span>
          {record.awayTeam.crest && (
            <img
              src={record.awayTeam.crest}
              alt=""
              style={{ width: 18, height: 18, marginLeft: 2, verticalAlign: 'middle' }}
            />
          )}
        </div>
      ),
      responsive: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
  ];

  return (
    <LayoutContainer>
      <div style={{ padding: '0' }}>
        <Card style={{ margin: 0 }}>
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CalendarOutlined />
              Calendario
            </h1>
          </div>

          {/* Filtros */}
          <div style={{ marginBottom: '16px' }}>
            <Space wrap>
              {/* Eliminado filtro por equipo y botones de buscar/borrar */}
              <Select
                placeholder="División"
                style={{ width: 150 }}
                value={filters.divisionId}
                allowClear
                onChange={(value) => setFilters(prev => ({ ...prev, divisionId: value, leagueId: undefined }))}
              >
                {divisions.map(division => (
                  <Option key={division.id} value={division.id}>
                    {division.name}
                  </Option>
                ))}
              </Select>
              {/* Filtro de liga/grupo dependiente de la división seleccionada (solo si hay más de un grupo) */}
              {filters.divisionId &&
                (() => {
                  const selectedDivision = divisions.find(d => d.id === filters.divisionId);
                  if (selectedDivision && selectedDivision.leagues.length > 1) {
                    return (
                      <Select
                        placeholder="Grupo"
                        style={{ width: 120 }}
                        value={filters.leagueId}
                        allowClear
                        onChange={(value) => setFilters(prev => ({ ...prev, leagueId: value }))}
                      >
                        {selectedDivision.leagues.map(league => (
                          <Option key={league.id} value={league.id}>
                            Grupo {league.groupCode}
                          </Option>
                        ))}
                      </Select>
                    );
                  }
                  return null;
                })()
              }
              <Select
                placeholder="Jornada"
                style={{ width: 180 }}
                value={filters.matchday}
                allowClear
                onChange={(value) => setFilters(prev => ({ ...prev, matchday: value }))}
                optionLabelProp="label"
                dropdownMatchSelectWidth={false}
              >
                {Array.from({ length: 38 }, (_, i) => i + 1).map(matchday => (
                  <Option key={matchday} value={matchday} label={`J${matchday}`}>
                    J{matchday}
                  </Option>
                ))}
                {/* Jornadas de playoff si existen partidos de playoff */}
                {stats.playoffMatches > 0 && matches.filter(m => m.isPlayoff && m.playoffRound)
                  .map(m => m.playoffRound)
                  .filter((v, i, arr) => v && arr.indexOf(v) === i)
                  .map(round => (
                    <Option key={round} value={round} label={round}>
                      {round}
                    </Option>
                  ))}
              </Select>
            </Space>
          </div>

          {/* Tabla de partidos */}
          <Table
            columns={columns}
            dataSource={matches}
            rowKey="id"
            loading={loading}
            pagination={{
              current: pagination.current,
              pageSize: 100,
              total: pagination.total,
              showSizeChanger: false,
              showQuickJumper: false,
              showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} partidos`,
              onChange: (page) => {
                setPagination(prev => ({
                  ...prev,
                  current: page,
                  pageSize: 100
                }));
              }
            }}
            scroll={{ x: 'max-content' }}
            onRow={record => ({
              onClick: () => navigate(`/match/${record.id}`),
              style: { cursor: 'pointer' }
            })}
          />
        </Card>
      </div>
    </LayoutContainer>
  );
}
