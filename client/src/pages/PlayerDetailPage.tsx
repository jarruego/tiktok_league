import { useEffect, useState } from 'react';
import { Avatar } from 'antd';
import TeamCrestSvg from '../components/TeamCrestSvg';
import { MdSportsSoccer } from 'react-icons/md';
import { useParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Player {
  id: number;
  name: string;
  position?: string;
  team?: { id: number; name: string; crest?: string; avatarUrl?: string; primaryColor?: string; secondaryColor?: string };
}

interface PlayerStats {
  goals: number;
  assists: number;
  matchesPlayed?: number;
}

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Array<{ matchday: number; goals: number; assists: number }>>([]);

  useEffect(() => {
    async function fetchPlayer() {
      setLoading(true);
      try {
        // Obtener datos básicos del jugador
        const res = await fetch(`/api/players/${id}`);
        if (!res.ok) throw new Error('No se pudo cargar el jugador');
        const data = await res.json();
        setPlayer(data);
  // ...
        // Obtener estadísticas de goles, asistencias y partidos jugados
        const statsRes = await fetch(`/api/stats/player/${id}`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        } else {
          setStats(null);
        }
        // Obtener progresión por jornada
        const progressRes = await fetch(`/api/stats/player/${id}/progress`);
        if (progressRes.ok) {
          const progressData = await progressRes.json();
          setProgress(Array.isArray(progressData) ? progressData : []);
        } else {
          setProgress([]);
        }
      } catch (e: any) {
        setError(e.message || 'Error desconocido');
      }
      setLoading(false);
    }
    fetchPlayer();
  }, [id]);

  if (loading) return <div style={{ textAlign: 'center', margin: 32 }}>Cargando...</div>;
  if (error) return <div style={{ color: 'red', textAlign: 'center', margin: 32 }}>{error}</div>;
  if (!player) return <div style={{ textAlign: 'center', margin: 32 }}>Jugador no encontrado</div>;

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 16 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 2px 12px #0002',
        padding: 24,
        gap: 24,
        marginBottom: 24
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 90 }}>
          {player.team?.crest || player.team?.avatarUrl ? (
            <Avatar size={80} src={player.team.crest || player.team.avatarUrl} style={{ backgroundColor: '#f0f0f0', marginBottom: 8 }}>
              {(player.team?.name || '').charAt(0).toUpperCase()}
            </Avatar>
          ) : player.team?.id ? (
            <TeamCrestSvg
              size={80}
              teamId={player.team.id}
              primaryColor={player.team.primaryColor}
              secondaryColor={player.team.secondaryColor}
              name={player.team.name}
            />
          ) : null}
          <span style={{ fontWeight: 500, fontSize: 16, marginTop: 6 }}>{player.team?.name || 'Sin equipo'}</span>
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: '0 0 8px 0', fontWeight: 700, fontSize: 28 }}>{player.name}</h2>
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888' }}>
              <MdSportsSoccer /> {player.position || 'Sin posición'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#888' }}>Goles</div>
              <div style={{ fontWeight: 600, fontSize: 22, color: '#388e3c' }}>{stats ? stats.goals : '-'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#888' }}>Asistencias</div>
              <div style={{ fontWeight: 600, fontSize: 22, color: '#1976d2' }}>{stats ? stats.assists : '-'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#888' }}>Partidos</div>
              <div style={{ fontWeight: 600, fontSize: 22, color: '#333' }}>{stats && typeof stats.matchesPlayed === 'number' ? stats.matchesPlayed : '-'}</div>
            </div>
          </div>
        </div>
      </div>
      {progress.length > 0 && (
        <div style={{ margin: '32px 0 0 0', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #0001', padding: 16 }}>
          <h4 style={{ margin: '0 0 12px 0', fontWeight: 600 }}>Progresión por jornada</h4>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={progress} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="matchday" label={{ value: 'Jornada', position: 'insideBottom', offset: -5 }} />
              <YAxis allowDecimals={false} label={{ value: 'Goles / Asistencias', angle: -90, position: 'insideLeft', offset: 10 }} />
              <Tooltip formatter={(value: any, name: string) => {
                if (name === 'goals') return [value, 'Goles'];
                if (name === 'assists') return [value, 'Asistencias'];
                return [value, name];
              }} />
              <Legend verticalAlign="bottom" height={36} formatter={(value) => {
                if (value === 'goals') return 'Goles';
                if (value === 'assists') return 'Asistencias';
                return value;
              }} />
              <Line type="monotone" dataKey="goals" stroke="#388e3c" strokeWidth={3} dot={{ r: 4 }} name="Goles" />
              <Line type="monotone" dataKey="assists" stroke="#1976d2" strokeWidth={3} dot={{ r: 4 }} name="Asistencias" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
