import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Player {
  id: number;
  name: string;
  position?: string;
  team?: { id: number; name: string };
}

interface PlayerStats {
  goals: number;
  assists: number;
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
        // Obtener estadísticas de goles y asistencias
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
    <div style={{ maxWidth: 500, margin: '0 auto', padding: 16 }}>
      <Link to="/mi-equipo" style={{ textDecoration: 'none', color: '#007bff' }}>← Volver a mi equipo</Link>
      <h2 style={{ margin: '16px 0 8px' }}>{player.name}</h2>
      <div style={{ marginBottom: 8 }}><b>Posición:</b> {player.position || 'Sin posición'}</div>
      <div style={{ marginBottom: 8 }}><b>Equipo:</b> {player.team?.name || 'Sin equipo'}</div>
      <div style={{ margin: '16px 0' }}>
        <b>Goles:</b> {stats ? stats.goals : '-'}<br />
        <b>Asistencias:</b> {stats ? stats.assists : '-'}
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
