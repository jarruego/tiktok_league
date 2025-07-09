import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Typography, Spin, Button, Modal, Divider } from 'antd';
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
  const [division1Matches, setDivision1Matches] = useState<any[]>([]);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const [simulationStats, scheduledMatches] = await Promise.all([
        matchApi.getSimulationStats(),
        matchApi.getMatches({ status: 'scheduled', limit: 20 })
      ]);
      
      setStats(simulationStats);
      
      // Todos los partidos programados
      setNextMatches(scheduledMatches.matches);
      
      // Filtrar solo los partidos de División 1 para la próxima fecha
      const dates = scheduledMatches.matches.map(m => m.scheduledDate);
      const uniqueDates = [...new Set(dates)].sort();
      const nextDate = uniqueDates[0];
      
      const division1MatchesForNextDate = scheduledMatches.matches.filter(
        m => m.scheduledDate === nextDate && m.league.name.includes('División 1')
      );
      
      setDivision1Matches(division1MatchesForNextDate);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Función para simular y actualizar los datos
  const handleSimulateAndRefresh = async () => {
    await onSimulate();
    // Esperar un breve momento para que la simulación se complete en el backend
    setTimeout(() => {
      loadStats();
    }, 1000);
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

  // Función para dividir los partidos en dos columnas
  const splitMatchesInColumns = (matches: any[]) => {
    const halfLength = Math.ceil(matches.length / 2);
    return [
      matches.slice(0, halfLength),
      matches.slice(halfLength)
    ];
  };

  const matchColumns = splitMatchesInColumns(division1Matches);

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
          onClick={handleSimulateAndRefresh}
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

            {/* Próximos Partidos - División 1 */}
            <Card size="small">
              <Title level={4}>⚽ División 1 - Jornada {division1Matches.length > 0 ? division1Matches[0].matchday : "N/A"} ({getNextMatchDate()})</Title>
              
              {division1Matches.length > 0 ? (
                <Row gutter={12}>
                  {/* Columna izquierda de partidos */}
                  <Col span={12}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {matchColumns[0].map(match => (
                        <div 
                          key={match.id}
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '6px 10px',
                            border: '1px solid #f0f0f0',
                            borderRadius: 6,
                            backgroundColor: '#fafafa',
                            fontSize: '13px'
                          }}
                        >
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: '100%',
                            textAlign: 'center'
                          }}>
                            <strong>{match.homeTeam.name}</strong>
                            <span style={{ margin: '0 6px', fontSize: '12px', color: '#888' }}>vs</span>
                            <strong>{match.awayTeam.name}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Col>
                  
                  {/* Columna derecha de partidos */}
                  <Col span={12}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {matchColumns[1].map(match => (
                        <div 
                          key={match.id}
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '6px 10px',
                            border: '1px solid #f0f0f0',
                            borderRadius: 6,
                            backgroundColor: '#fafafa',
                            fontSize: '13px'
                          }}
                        >
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: '100%',
                            textAlign: 'center'
                          }}>
                            <strong>{match.homeTeam.name}</strong>
                            <span style={{ margin: '0 6px', fontSize: '12px', color: '#888' }}>vs</span>
                            <strong>{match.awayTeam.name}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Col>
                </Row>
              ) : (
                <Text type="secondary">No hay partidos programados de División 1</Text>
              )}
              
              {division1Matches.length === 0 && nextMatches.length > 0 && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <Text type="secondary">Hay {nextMatches.length} partidos programados en otras divisiones</Text>
                </>
              )}
            </Card>
          </>
        )}
      </Spin>
    </Modal>
  );
};
