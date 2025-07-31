import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Table, Row, Col, Typography, Spin } from 'antd';
import TeamCrestSvg from '../components/TeamCrestSvg';
import type { TeamCommon } from '../types/team.types';

const { Title } = Typography;

// ...existing code...
import type { ColumnsType } from 'antd/es/table';

// Asegúrate de que el tipo Match use TeamInfo
interface Match {
  id: number;
  homeTeam: TeamCommon;
  awayTeam: TeamCommon;
  homeGoals?: number;
  awayGoals?: number;
  // ...otros campos...
}

interface PlayerStat {
  playerId: number;
  playerName: string;
  goals: number;
  assists: number;
  goalMinutes?: number[];
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
    render: (goles: number, record: PlayerStat) => (
      <span>
        {goles}
        {record.goalMinutes && record.goalMinutes.length > 0 && (
          <span style={{ color: '#888', fontSize: 12, marginLeft: 4 }}>
            ({record.goalMinutes.sort((a, b) => a - b).join("', ")}")
          </span>
        )}
      </span>
    ),
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
    <div style={{ width: '100vw', minHeight: '100vh', background: 'linear-gradient(135deg, #f5f6fa 60%, #e6e9f0 100%)', padding: 24 }}>
      <Row gutter={0} justify="center" align="top" style={{ marginBottom: 24, width: '100%' }}>
        <Col xs={24} style={{ width: '100%' }}>
          <Card bordered style={{ borderRadius: 12, background: '#f0f7ff', boxShadow: '0 2px 8px #d6e4ff', width: '100%' }}>
            <Row align="middle" justify="space-between" style={{ width: '100%' }}>
              <Col xs={8} style={{ textAlign: 'center' }}>
                {match.homeTeam.crest ? (
                  <img src={match.homeTeam.crest} alt="escudo local" style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 4 }} />
                ) : (
                  <TeamCrestSvg
                    size={48}
                    teamId={match.homeTeam.id}
                    primaryColor={match.homeTeam.primaryColor}
                    secondaryColor={match.homeTeam.secondaryColor}
                    name={match.homeTeam.name}
                  />
                )}
                <div style={{ fontWeight: 600, color: '#1e90ff', fontSize: 18 }}>{match.homeTeam.name}</div>
              </Col>
              <Col xs={8} style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 48, fontWeight: 900, color: '#222', letterSpacing: 2 }}>
                  {match.homeGoals ?? '-'}<span style={{ color: '#888', fontWeight: 400, fontSize: 32 }}> - </span>{match.awayGoals ?? '-'}
                </span>
              </Col>
              <Col xs={8} style={{ textAlign: 'center' }}>
                {match.awayTeam.crest ? (
                  <img src={match.awayTeam.crest} alt="escudo visitante" style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 4 }} />
                ) : (
                  <TeamCrestSvg
                    size={48}
                    teamId={match.awayTeam.id}
                    primaryColor={match.awayTeam.primaryColor}
                    secondaryColor={match.awayTeam.secondaryColor}
                    name={match.awayTeam.name}
                  />
                )}
                <div style={{ fontWeight: 600, color: '#d72660', fontSize: 18 }}>{match.awayTeam.name}</div>
              </Col>
            </Row>
            <Row gutter={24} style={{ marginTop: 16 }}>
              <Col xs={24} sm={12}>
                <Table
                  columns={columns}
                  dataSource={stats.home}
                  pagination={false}
                  rowKey="playerId"
                  size="small"
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} sm={12}>
                <Table
                  columns={columns}
                  dataSource={stats.away}
                  pagination={false}
                  rowKey="playerId"
                  size="small"
                  style={{ width: '100%' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
      <Row justify="center">
        <Col xs={24} sm={20} md={12}>
          <Card bordered style={{ borderRadius: 12, background: '#f9fafc', boxShadow: '0 2px 8px #e6e9f0' }}>
            <Title level={4} style={{ color: '#555' }}>Crónica del partido</Title>
            <div style={{ color: '#aaa', minHeight: 60 }}>[Aquí irá la crónica próximamente]</div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
