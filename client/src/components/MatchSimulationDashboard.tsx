import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Typography, Spin, Button, Modal, Tag } from 'antd';
import { 
  PlayCircleOutlined, 
  TrophyOutlined, 
  CalendarOutlined,
  FireOutlined,
  HomeOutlined,
  TeamOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { matchApi } from '../api/matchApi';

const { Title, Text } = Typography;

interface SimulationStatsProps {
  visible: boolean;
  onClose: () => void;
  onSimulate: () => void;
  loading: boolean;
}

export const MatchSimulationDashboard: React.FC<SimulationStatsProps> = ({
  visible,
  onClose,
  onSimulate,
  loading
}) => {
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [nextMatches, setNextMatches] = useState<any[]>([]);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const [simulationStats, scheduledMatches] = await Promise.all([
        matchApi.getSimulationStats(),
        matchApi.getMatches({ status: 'scheduled', limit: 5 })
      ]);
      
      setStats(simulationStats);
      setNextMatches(scheduledMatches.matches);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadStats();
    }
  }, [visible]);

  const getNextMatchDate = () => {
    if (nextMatches.length === 0) return 'No hay partidos programados';
    
    const dates = nextMatches.map(m => m.scheduledDate);
    const uniqueDates = [...new Set(dates)].sort();
    return uniqueDates[0];
  };

  const getMatchesForNextDate = () => {
    const nextDate = getNextMatchDate();
    return nextMatches.filter(m => m.scheduledDate === nextDate);
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlayCircleOutlined style={{ color: '#52c41a' }} />
          <span>Dashboard de Simulación de Partidos</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="close" onClick={onClose}>
          Cerrar
        </Button>,
        <Button 
          key="simulate" 
          type="primary" 
          loading={loading}
          onClick={onSimulate}
          disabled={nextMatches.length === 0}
          style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
          icon={<PlayCircleOutlined />}
        >
          Simular Siguiente Jornada
        </Button>
      ]}
    >
      <Spin spinning={loadingStats}>
        {stats && (
          <>
            {/* Estadísticas Generales */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Title level={4}>📊 Estadísticas Generales</Title>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Total Partidos"
                    value={stats.totalMatches}
                    prefix={<CalendarOutlined />}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Pendientes"
                    value={stats.scheduledMatches}
                    prefix={<FireOutlined />}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Finalizados"
                    value={stats.finishedMatches}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
              </Row>
            </Card>

            {/* Estadísticas de Resultados */}
            {stats.finishedMatches > 0 && (
              <Card size="small" style={{ marginBottom: 16 }}>
                <Title level={4}>🏆 Estadísticas de Resultados</Title>
                <Row gutter={16}>
                  <Col span={6}>
                    <Statistic
                      title="Promedio Goles"
                      value={Number(stats.averageGoalsPerMatch).toFixed(2)}
                      prefix={<TrophyOutlined />}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="Victorias Locales"
                      value={stats.homeWins}
                      prefix={<HomeOutlined />}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="Victorias Visitantes"
                      value={stats.awayWins}
                      prefix={<TeamOutlined />}
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="Empates"
                      value={stats.draws}
                      valueStyle={{ color: '#8c8c8c' }}
                    />
                  </Col>
                </Row>
              </Card>
            )}

            {/* Próximos Partidos */}
            <Card size="small">
              <Title level={4}>⚽ Siguiente Jornada - {getNextMatchDate()}</Title>
              {getMatchesForNextDate().length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {getMatchesForNextDate().map(match => (
                    <div 
                      key={match.id}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '8px 12px',
                        border: '1px solid #f0f0f0',
                        borderRadius: 6,
                        backgroundColor: '#fafafa'
                      }}
                    >
                      <span>
                        <strong>{match.homeTeam.name}</strong> vs <strong>{match.awayTeam.name}</strong>
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Tag color="blue">{match.league.name}</Tag>
                        <Tag>Jornada {match.matchday}</Tag>
                      </div>
                    </div>
                  ))}
                  {nextMatches.length > getMatchesForNextDate().length && (
                    <Text type="secondary">
                      ... y {nextMatches.length - getMatchesForNextDate().length} partidos más en otras fechas
                    </Text>
                  )}
                </div>
              ) : (
                <Text type="secondary">No hay partidos programados</Text>
              )}
            </Card>
          </>
        )}
      </Spin>
    </Modal>
  );
};
