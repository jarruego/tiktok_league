import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Table, Row, Col, Typography, Spin, Divider } from 'antd';

const { Title } = Typography;

import type { Match } from '../types/match.types';
import type { ColumnsType } from 'antd/es/table';

interface PlayerStat {
  playerId: number;
  playerName: string;
  goals: number;
  assists: number;
}

const columns: ColumnsType<PlayerStat> = [
  {
    title: 'Jugador',
    dataIndex: 'playerName',
    key: 'playerName',
  },
  {
    title: 'Goles',
    dataIndex: 'goals',
    key: 'goals',
    align: 'center' as const,
  },
  {
    title: 'Asistencias',
    dataIndex: 'assists',
    key: 'assists',
    align: 'center' as const,
  },
];


export default function MatchDetailPage() {
  const { matchId } = useParams();
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<Match | null>(null);
  const [stats, setStats] = useState<{ home: PlayerStat[]; away: PlayerStat[] }>({ home: [], away: [] });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // Suponiendo que el backend expone /api/matches/:id/detail
        const res = await fetch(`/api/matches/${matchId}/detail`);
        if (!res.ok) throw new Error('No se pudo cargar el detalle');
        const data = await res.json();
        setMatch(data.match);
        setStats({ home: data.homeStats, away: data.awayStats });
      } catch (e) {
        setMatch(null);
      }
      setLoading(false);
    }
    fetchData();
  }, [matchId]);

  if (loading) return <Spin style={{ width: '100vw', height: '100vh' }} />;
  if (!match) return <div>No se encontró el partido.</div>;

  return (
    <div style={{ width: '100vw', minHeight: '100vh', background: '#fff' }}>
      <Row style={{ width: '100%' }} gutter={0}>
        <Col xs={24} sm={12} style={{ padding: 0 }}>
          <Card bordered={false} style={{ borderRadius: 0, boxShadow: 'none' }}>
            <Title level={3} style={{ margin: 0 }}>{match.homeTeam.name}</Title>
            <Title level={1} style={{ margin: 0 }}>{match.homeGoals}</Title>
            <Table
              columns={columns}
              dataSource={stats.home}
              pagination={false}
              rowKey="playerId"
              size="small"
              style={{ width: '100%' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} style={{ padding: 0 }}>
          <Card bordered={false} style={{ borderRadius: 0, boxShadow: 'none' }}>
            <Title level={3} style={{ margin: 0 }}>{match.awayTeam.name}</Title>
            <Title level={1} style={{ margin: 0 }}>{match.awayGoals}</Title>
            <Table
              columns={columns}
              dataSource={stats.away}
              pagination={false}
              rowKey="playerId"
              size="small"
              style={{ width: '100%' }}
            />
          </Card>
        </Col>
      </Row>
      <Divider />
      <div style={{ minHeight: 120, width: '100%' }}>
        <Title level={4}>Crónica del partido</Title>
        <div style={{ color: '#aaa' }}>[Aquí irá la crónica próximamente]</div>
      </div>
    </div>
  );
}
