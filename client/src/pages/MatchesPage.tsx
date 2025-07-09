import { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Select, 
  DatePicker, 
  message, 
  Space, 
  Tag, 
  Divider,
  Statistic,
  Row,
  Col
} from 'antd';
import { 
  CalendarOutlined, 
  TrophyOutlined, 
  TeamOutlined,
  PlayCircleOutlined,
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
import type { Season, Division } from '../types/league.types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

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
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [filters, setFilters] = useState<MatchFilters>({});
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
      
      setSeasons(seasonsData);
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

  const clearFilters = () => {
    setFilters({});
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
      <div style={{ padding: '24px 16px' }}>
        <Card style={{ margin: 0 }}>
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CalendarOutlined />
              Calendario de Partidos
            </h1>
          </div>

          {/* Estadísticas */}
          {selectedSeason && (
            <>
              <Row gutter={16} style={{ marginBottom: '16px' }}>
                <Col span={4}>
                  <Statistic
                    title="Total Partidos"
                    value={stats.totalMatches}
                    prefix={<TrophyOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Programados"
                    value={stats.scheduledMatches}
                    prefix={<CalendarOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Finalizados"
                    value={stats.finishedMatches}
                    prefix={<PlayCircleOutlined />}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Jornadas"
                    value={stats.totalMatchdays}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="Ligas"
                    value={stats.leaguesCount}
                    prefix={<TeamOutlined />}
                  />
                </Col>
              </Row>
              
              {/* Segunda fila con estadísticas de playoffs */}
              <Row gutter={16} style={{ marginBottom: '8px' }}>
                <Col span={4}>
                  <Statistic
                    title="Liga Regular"
                    value={stats.regularMatches}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="🏆 Playoffs"
                    value={stats.playoffMatches}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
                {stats.playoffMatches > 0 && (
                  <Col span={16}>
                    <div style={{ 
                      padding: '8px 12px',
                      background: '#fff7e6',
                      border: '1px solid #ffd666',
                      borderRadius: '6px',
                      fontSize: '13px'
                    }}>
                      <TrophyOutlined style={{ color: '#faad14', marginRight: '6px' }} />
                      <strong>Playoffs activos:</strong> {stats.playoffMatches} partidos de eliminatoria detectados
                    </div>
                  </Col>
                )}
              </Row>
            </>
          )}

          <Divider />

          {/* Filtros */}
          <div style={{ marginBottom: '16px' }}>
            <Space wrap>
              <Select
                placeholder="Seleccionar temporada"
                style={{ width: 200 }}
                value={selectedSeason}
                onChange={handleSeasonChange}
              >
                {seasons.map(season => (
                  <Option key={season.id} value={season.id}>
                    {season.name} {season.isActive && '(Activa)'}
                  </Option>
                ))}
              </Select>

              <Select
                placeholder="División"
                style={{ width: 150 }}
                value={filters.divisionId}
                allowClear
                onChange={(value) => setFilters(prev => ({ ...prev, divisionId: value }))}
              >
                {divisions.map(division => (
                  <Option key={division.id} value={division.id}>
                    {division.name}
                  </Option>
                ))}
              </Select>

              <Select
                placeholder="Estado"
                style={{ width: 120 }}
                value={filters.status}
                allowClear
                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <Option value="scheduled">Programados</Option>
                <Option value="finished">Finalizados</Option>
                <Option value="live">En curso</Option>
                <Option value="postponed">Aplazados</Option>
                <Option value="cancelled">Cancelados</Option>
              </Select>

              <Select
                placeholder="Tipo de partido"
                style={{ width: 130 }}
                value={filters.isPlayoff !== undefined ? (filters.isPlayoff ? 'playoff' : 'regular') : undefined}
                allowClear
                onChange={(value) => {
                  if (value === 'playoff') {
                    setFilters(prev => ({ ...prev, isPlayoff: true }));
                  } else if (value === 'regular') {
                    setFilters(prev => ({ ...prev, isPlayoff: false }));
                  } else {
                    setFilters(prev => ({ ...prev, isPlayoff: undefined }));
                  }
                }}
              >
                <Option value="regular">Liga Regular</Option>
                <Option value="playoff">🏆 Playoffs</Option>
              </Select>

              {filters.isPlayoff === true && (
                <Select
                  placeholder="Ronda de playoff"
                  style={{ width: 140 }}
                  value={filters.playoffRound}
                  allowClear
                  onChange={(value) => setFilters(prev => ({ ...prev, playoffRound: value }))}
                >
                  <Option value="Semifinal">Semifinal</Option>
                  <Option value="Final">Final</Option>
                  <Option value="Cuartos">Cuartos</Option>
                  <Option value="Primera Ronda">Primera Ronda</Option>
                </Select>
              )}

              <Select
                placeholder="Jornada"
                style={{ width: 100 }}
                value={filters.matchday}
                allowClear
                onChange={(value) => setFilters(prev => ({ ...prev, matchday: value }))}
              >
                {Array.from({ length: stats.totalMatchdays }, (_, i) => i + 1).map(matchday => (
                  <Option key={matchday} value={matchday}>
                    J{matchday}
                  </Option>
                ))}
              </Select>

              <RangePicker
                placeholder={['Fecha desde', 'Fecha hasta']}
                value={[
                  filters.fromDate ? dayjs(filters.fromDate) : null,
                  filters.toDate ? dayjs(filters.toDate) : null
                ]}
                onChange={(dates) => {
                  setFilters(prev => ({
                    ...prev,
                    fromDate: dates?.[0]?.format('YYYY-MM-DD') || undefined,
                    toDate: dates?.[1]?.format('YYYY-MM-DD') || undefined
                  }));
                }}
              />

              <Button 
                icon={<ReloadOutlined />} 
                onClick={loadMatches}
                loading={loading}
              >
                Actualizar
              </Button>

              <Button 
                icon={<ClearOutlined />}
                onClick={clearFilters}
                disabled={Object.keys(filters).filter(key => filters[key as keyof typeof filters] !== undefined).length === 0}
              >
                Limpiar Filtros
              </Button>

              {stats.playoffMatches > 0 && (
                <Button 
                  type={filters.isPlayoff === true ? "primary" : "default"}
                  icon={<TrophyOutlined />}
                  onClick={() => {
                    if (filters.isPlayoff === true) {
                      setFilters(prev => ({ ...prev, isPlayoff: undefined, playoffRound: undefined }));
                    } else {
                      setFilters(prev => ({ ...prev, isPlayoff: true }));
                    }
                  }}
                  style={{ borderColor: '#faad14', color: filters.isPlayoff === true ? '#fff' : '#faad14' }}
                >
                  Ver Playoffs ({stats.playoffMatches})
                </Button>
              )}
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
