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
import type { MatchFilters } from '../types/match.types';
import type { Division } from '../types/league.types';
import type { ColumnsType } from 'antd/es/table';
import TeamCrestSvg from '../components/TeamCrestSvg';
import type { TeamCommon } from '../types/team.types';

const { Option } = Select;

// Asegúrate de que el tipo Match use TeamCommon
interface Match {
  id: number;
  homeTeam: TeamCommon;
  awayTeam: TeamCommon;
  homeGoals?: number;
  awayGoals?: number;
  isPlayoff?: boolean;
  matchday?: number;
  scheduledDate?: string;
  playoffRound?: string;
  // ...otros campos...
}

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
  const [initialized, setInitialized] = useState(false);

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
          let foundLeague = null;
          let foundDivision = null;
          for (const division of divisionsData) {
            for (const league of division.leagues) {
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
            const matchesResp = await matchApi.getMatchesBySeason(activeSeason.id, { leagueId: foundLeague.id });
            const nextMatch = matchesResp.matches.find(m => m.status === 'scheduled' || m.status === 'live');
            const nextMatchday = nextMatch ? nextMatch.matchday : undefined;
            // Solo setea los filtros una vez, y marca como inicializado
            setFilters({
              divisionId: foundDivision.id,
              leagueId: foundLeague.id,
              matchday: nextMatchday
            });
            setInitialized(true);
            return;
          }
        }
      }
      // Si no hay equipo o no se encuentra, marca como inicializado igualmente
      setInitialized(true);
    } catch (error) {
      console.error('Error loading initial data:', error);
      message.error('Error cargando datos iniciales');
      setInitialized(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedSeason && initialized) {
      loadMatches();
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeason, filters, pagination.current, pagination.pageSize, initialized]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
    if (selectedSeason && initialized) {
      loadMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, initialized]);

  // Mostrar animación de carga solo antes del return principal
  if (loading || !initialized) {
    return <LoadingBallAnimation text="Cargando partidos..." />;
  }


  const columns: ColumnsType<Match> = [
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
          gap: 2,
          width: '100%'
        }}>
          {/* Home team escudo */}
          {record.homeTeam.crest ? (
            <img
              src={record.homeTeam.crest}
              alt=""
              style={{ width: 18, height: 18, marginRight: 2, verticalAlign: 'middle' }}
            />
          ) : (
            <TeamCrestSvg
              size={18}
              teamId={record.homeTeam.id}
              primaryColor={record.homeTeam.primaryColor}
              secondaryColor={record.homeTeam.secondaryColor}
              name={record.homeTeam.name}
            />
          )}
          <span style={{ fontWeight: 500, fontSize: 13, color: '#1e90ff' }}>
            {record.homeTeam.shortName || record.homeTeam.name}
          </span>
          {/* Resultado */}
          <span style={{ fontWeight: 700, fontSize: 15, margin: '0 3px', minWidth: 36, textAlign: 'center', color: '#222', display: 'inline-block' }}>
            {record.homeGoals !== null && record.awayGoals !== null
              ? `${record.homeGoals} - ${record.awayGoals}`
              : <span style={{ color: '#999', fontWeight: 400 }}>vs</span>}
          </span>
          {/* Visitante */}
          <span style={{ fontWeight: 500, fontSize: 13, color: '#d72660' }}>
            {record.awayTeam.shortName || record.awayTeam.name}
          </span>
          {record.awayTeam.crest ? (
            <img
              src={record.awayTeam.crest}
              alt=""
              style={{ width: 18, height: 18, marginLeft: 2, verticalAlign: 'middle' }}
            />
          ) : (
            <TeamCrestSvg
              size={18}
              teamId={record.awayTeam.id}
              primaryColor={record.awayTeam.primaryColor}
              secondaryColor={record.awayTeam.secondaryColor}
              name={record.awayTeam.name}
            />
          )}
        </div>
      ),
      responsive: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    {
      title: 'Jornada',
      key: 'jornada',
      width: 110,
      render: (_, record) => {
        if (record.isPlayoff && record.playoffRound) {
          // Playoff: muestra ronda y fecha
          const dateStr = record.scheduledDate ? dayjs(record.scheduledDate).format('DD/MM') : '';
          return (
            <span style={{ color: '#d72660', fontWeight: 700 }}>
              {record.playoffRound} {dateStr && `(${dateStr})`}
            </span>
          );
        }
        const matchday = record.matchday ?? '-';
        const dateStr = record.scheduledDate ? dayjs(record.scheduledDate).format('DD/MM') : '';
        return (
          <span>
            {matchday} {dateStr && `(${dateStr})`}
          </span>
        );
      },
      sorter: (a, b) => {
        // Ordena por matchday, luego por fecha
        const mdA = a.matchday ?? 0;
        const mdB = b.matchday ?? 0;
        if (mdA !== mdB) return mdA - mdB;
        return dayjs(a.scheduledDate).unix() - dayjs(b.scheduledDate).unix();
      },
      responsive: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
  ];

  return (
    <LayoutContainer>
      <div style={{ padding: 0, margin: '10px 0' }}>
        <Card style={{ margin: 0, padding: 0, boxShadow: 'none', border: 'none' }} bodyStyle={{ padding: 0, margin: 0 }}>
          <div style={{ padding: '10px 5px' }}>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px', fontSize: 24 }}>
              <CalendarOutlined />
              Calendario
            </h1>
          </div>

          {/* Filtros */}
          <div style={{ padding: '5px' }}>
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
