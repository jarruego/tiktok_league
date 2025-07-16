import { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Select, 
  message, 
  Space, 
  Tag
} from 'antd';
import { 
  CalendarOutlined, 
  TrophyOutlined,
  ReloadOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { LayoutContainer } from '../components/LayoutContainer';
import { matchApi } from '../api/matchApi';
import { leagueApi } from '../api/leagueApi';
import type { 
  Match, 
  MatchFilters
} from '../types/match.types';
import type { Division } from '../types/league.types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Option } = Select;

const statusColors = {
  scheduled: 'blue',
  live: 'green',
  finished: 'default',
  postponed: 'orange',
  cancelled: 'red'
};

const statusLabels = {
  scheduled: 'Programado',
  live: 'En Curso',
  finished: 'Finalizado',
  postponed: 'Aplazado',
  cancelled: 'Cancelado'
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [filters, setFilters] = useState<MatchFilters>({});
  const [teamName, setTeamName] = useState<string>('');
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
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

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      loadMatches();
      loadStats();
    }
  }, [selectedSeason, filters, pagination.current, pagination.pageSize]);

  // Reset pagination when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, current: 1 }));
  }, [filters]);

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
      let filteredMatches = response.matches;
      if (teamName && teamName.trim() !== '') {
        const name = teamName.trim().toLowerCase();
        filteredMatches = filteredMatches.filter(m =>
          m.homeTeam.name.toLowerCase().includes(name) ||
          m.homeTeam.shortName?.toLowerCase().includes(name) ||
          m.awayTeam.name.toLowerCase().includes(name) ||
          m.awayTeam.shortName?.toLowerCase().includes(name)
        );
      }
      setMatches(filteredMatches);
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

  const clearFilters = () => {
    setFilters({});
    setTeamName('');
  };

  const handleSeasonChange = (seasonId: number) => {
    setSelectedSeason(seasonId);
    // Limpiar filtros al cambiar temporada
    setFilters({});
  };

  const columns: ColumnsType<Match> = [
    {
      title: 'J.',
      dataIndex: 'matchday',
      key: 'matchday',
      width: 50,
      render: (matchday: number, record) => {
        if (record.isPlayoff) {
          return (
            <Tag color="gold" style={{ fontSize: '11px', padding: '2px 6px' }}>
              PO
            </Tag>
          );
        }
        return matchday;
      },
      sorter: (a, b) => a.matchday - b.matchday,
    },
    {
      title: 'Fecha',
      dataIndex: 'scheduledDate',
      key: 'scheduledDate',
      width: 100,
      render: (date: string) => dayjs(date).format('DD/MM'),
      sorter: (a, b) => dayjs(a.scheduledDate).unix() - dayjs(b.scheduledDate).unix(),
    },
    {
      title: 'Local',
      key: 'homeTeam',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          {record.homeTeam.crest && (
            <img 
              src={record.homeTeam.crest} 
              alt="" 
              style={{ width: 16, height: 16 }} 
            />
          )}
          <span style={{ fontSize: '13px' }}>{record.homeTeam.shortName || record.homeTeam.name}</span>
        </Space>
      ),
    },
    {
      title: 'Resultado',
      key: 'result',
      width: 80,
      align: 'center',
      render: (_, record) => {
        if (record.homeGoals !== null && record.awayGoals !== null) {
          return `${record.homeGoals} - ${record.awayGoals}`;
        }
        return <span style={{ color: '#999' }}>vs</span>;
      },
    },
    {
      title: 'Visitante',
      key: 'awayTeam',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          {record.awayTeam.crest && (
            <img 
              src={record.awayTeam.crest} 
              alt="" 
              style={{ width: 16, height: 16 }} 
            />
          )}
          <span style={{ fontSize: '13px' }}>{record.awayTeam.shortName || record.awayTeam.name}</span>
        </Space>
      ),
    },
    {
      title: 'Liga',
      key: 'league',
      width: 140,
      render: (_, record) => (
        <div>
          <div style={{ fontSize: '12px' }}>
            {record.isPlayoff ? (
              <Space size={4}>
                <TrophyOutlined style={{ color: '#faad14' }} />
                <span style={{ fontWeight: 'bold', color: '#faad14' }}>
                  Playoff
                </span>
              </Space>
            ) : (
              record.league.name
            )}
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>
            {record.isPlayoff && record.playoffRound ? (
              record.playoffRound
            ) : (
              record.division.name
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={statusColors[status as keyof typeof statusColors]}>
          {statusLabels[status as keyof typeof statusLabels]}
        </Tag>
      ),
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
              <input
                type="text"
                placeholder="Buscar por equipo"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                style={{ width: 200, padding: '4px 8px', borderRadius: 4, border: '1px solid #d9d9d9' }}
              />
              <Button 
                icon={<ReloadOutlined />} 
                onClick={loadMatches}
                loading={loading}
                style={{ padding: '0 8px' }}
              />
              <Button 
                icon={<ClearOutlined />}
                onClick={clearFilters}
                disabled={Object.keys(filters).filter(key => filters[key as keyof typeof filters] !== undefined).length === 0}
                style={{ padding: '0 8px' }}
              />
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
              {/* Filtro de liga/grupo dependiente de la división seleccionada */}
              {filters.divisionId && (
                <Select
                  placeholder="Grupo"
                  style={{ width: 120 }}
                  value={filters.leagueId}
                  allowClear
                  onChange={(value) => setFilters(prev => ({ ...prev, leagueId: value }))}
                >
                  {(divisions.find(d => d.id === filters.divisionId)?.leagues || []).map(league => (
                    <Option key={league.id} value={league.id}>
                      Grupo {league.groupCode}
                    </Option>
                  ))}
                </Select>
              )}
              <Select
                placeholder="Jornada"
                style={{ width: 120 }}
                value={filters.matchday}
                allowClear
                onChange={(value) => setFilters(prev => ({ ...prev, matchday: value }))}
              >
                {/* Jornadas de liga regular (1-38) */}
                {Array.from({ length: 38 }, (_, i) => i + 1).map(matchday => (
                  <Option key={matchday} value={matchday}>
                    J{matchday}
                  </Option>
                ))}
                {/* Jornadas de playoff si existen partidos de playoff */}
                {stats.playoffMatches > 0 && matches.filter(m => m.isPlayoff && m.playoffRound).map(m => m.playoffRound).filter((v, i, arr) => v && arr.indexOf(v) === i).map(round => (
                  <Option key={round} value={round}>
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
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `${range[0]}-${range[1]} de ${total} partidos`,
              onChange: (page, pageSize) => {
                setPagination(prev => ({
                  ...prev,
                  current: page,
                  pageSize: pageSize || 50
                }));
              }
            }}
            scroll={{ x: 740 }}
          />
        </Card>
      </div>
    </LayoutContainer>
  );
}
