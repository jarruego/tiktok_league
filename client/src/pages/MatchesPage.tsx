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
  Col,
  Modal,
  Form,
  Input
} from 'antd';
import { 
  CalendarOutlined, 
  TrophyOutlined, 
  TeamOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { LayoutContainer } from '../components/LayoutContainer';
import { matchApi } from '../api/matchApi';
import { leagueApi } from '../api/leagueApi';
import { usePermissions } from '../hooks/usePermissions';
import type { 
  Match, 
  MatchFilters, 
  GenerateMatchesRequest 
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
  const [generating, setGenerating] = useState(false);
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
    leaguesCount: 0
  });
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [form] = Form.useForm();

  const { canAdministrate } = usePermissions();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      loadMatches();
      loadStats();
    }
  }, [selectedSeason, filters, pagination.current, pagination.pageSize]);

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
      setStats(seasonStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleGenerateMatches = async (values: any) => {
    try {
      setGenerating(true);
      const generateData: GenerateMatchesRequest = {
        seasonId: selectedSeason!,
        startDate: values.startDate ? dayjs(values.startDate).format('YYYY-MM-DD') : undefined,
        daysPerMatchday: values.daysPerMatchday || 7
      };
      
      const result = await matchApi.generateMatches(generateData);
      
      message.success(
        `${result.totalMatches} partidos generados para ${result.leaguesProcessed} ligas`
      );
      
      setGenerateModalVisible(false);
      form.resetFields();
      loadMatches();
      loadStats();
    } catch (error: any) {
      console.error('Error generating matches:', error);
      message.error(error.message || 'Error generando partidos');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteAllMatches = async () => {
    if (!selectedSeason) return;
    
    Modal.confirm({
      title: '¿Eliminar todos los partidos?',
      content: 'Esta acción eliminará todos los partidos de la temporada seleccionada. ¿Estás seguro?',
      okText: 'Sí, eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const result = await matchApi.deleteAllMatchesBySeason(selectedSeason);
          message.success(`${result.deletedCount} partidos eliminados`);
          loadMatches();
          loadStats();
        } catch (error: any) {
          message.error(error.message || 'Error eliminando partidos');
        }
      }
    });
  };

  const columns: ColumnsType<Match> = [
    {
      title: 'Jornada',
      dataIndex: 'matchday',
      key: 'matchday',
      width: 80,
      sorter: (a, b) => a.matchday - b.matchday,
    },
    {
      title: 'Fecha',
      dataIndex: 'scheduledDate',
      key: 'scheduledDate',
      width: 120,
      render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
      sorter: (a, b) => dayjs(a.scheduledDate).unix() - dayjs(b.scheduledDate).unix(),
    },
    {
      title: 'Local',
      key: 'homeTeam',
      width: 200,
      render: (_, record) => (
        <Space>
          {record.homeTeam.crest && (
            <img 
              src={record.homeTeam.crest} 
              alt="" 
              style={{ width: 20, height: 20 }} 
            />
          )}
          <span>{record.homeTeam.shortName || record.homeTeam.name}</span>
        </Space>
      ),
    },
    {
      title: 'Resultado',
      key: 'result',
      width: 100,
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
      width: 200,
      render: (_, record) => (
        <Space>
          {record.awayTeam.crest && (
            <img 
              src={record.awayTeam.crest} 
              alt="" 
              style={{ width: 20, height: 20 }} 
            />
          )}
          <span>{record.awayTeam.shortName || record.awayTeam.name}</span>
        </Space>
      ),
    },
    {
      title: 'Liga',
      key: 'league',
      width: 150,
      render: (_, record) => (
        <div>
          <div>{record.league.name}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.division.name}
          </div>
        </div>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColors[status as keyof typeof statusColors]}>
          {statusLabels[status as keyof typeof statusLabels]}
        </Tag>
      ),
    },
  ];

  return (
    <LayoutContainer>
      <div style={{ padding: '24px' }}>
        <Card>
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CalendarOutlined />
              Calendario de Partidos
            </h1>
          </div>

          {/* Estadísticas */}
          {selectedSeason && (
            <Row gutter={16} style={{ marginBottom: '24px' }}>
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
          )}

          <Divider />

          {/* Filtros */}
          <div style={{ marginBottom: '16px' }}>
            <Space wrap>
              <Select
                placeholder="Seleccionar temporada"
                style={{ width: 200 }}
                value={selectedSeason}
                onChange={setSelectedSeason}
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
                allowClear
                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <Option value="scheduled">Programados</Option>
                <Option value="finished">Finalizados</Option>
                <Option value="live">En curso</Option>
              </Select>

              <RangePicker
                placeholder={['Fecha desde', 'Fecha hasta']}
                onChange={(dates) => {
                  setFilters(prev => ({
                    ...prev,
                    fromDate: dates?.[0]?.format('YYYY-MM-DD'),
                    toDate: dates?.[1]?.format('YYYY-MM-DD')
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
            </Space>
          </div>

          {/* Acciones de administrador */}
          {canAdministrate && selectedSeason && (
            <div style={{ marginBottom: '16px' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<CalendarOutlined />}
                  onClick={() => setGenerateModalVisible(true)}
                  disabled={stats.totalMatches > 0}
                >
                  Generar Calendario
                </Button>
                
                {stats.totalMatches > 0 && (
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={handleDeleteAllMatches}
                  >
                    Eliminar Todos los Partidos
                  </Button>
                )}
              </Space>
            </div>
          )}

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
            scroll={{ x: 1000 }}
          />
        </Card>

        {/* Modal para generar partidos */}
        <Modal
          title="Generar Calendario de Partidos"
          open={generateModalVisible}
          onCancel={() => setGenerateModalVisible(false)}
          footer={null}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleGenerateMatches}
          >
            <Form.Item
              label="Fecha de inicio"
              name="startDate"
              tooltip="Si no se especifica, se usará la fecha de inicio de la temporada"
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              label="Días entre jornadas"
              name="daysPerMatchday"
              initialValue={7}
              tooltip="Número de días entre cada jornada (por defecto 7 días = 1 semana)"
            >
              <Input type="number" min={1} max={30} />
            </Form.Item>

            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setGenerateModalVisible(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={generating}
                >
                  Generar Partidos
                </Button>
              </Space>
            </div>
          </Form>
        </Modal>
      </div>
    </LayoutContainer>
  );
}
