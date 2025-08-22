import { useEffect, useState } from 'react';
import LoadingBallAnimation from '../components/LoadingBallAnimation';
import { useAuth } from '../context/AuthContext';
import { leagueApi } from '../api/leagueApi';
import type { Division, League } from '../types/league.types';

interface PlayerStat {
  id: number;
  name: string;
  team: string;
  value: number;
}

export default function StatsPage() {
  const { user } = useAuth();
  const [scorers, setScorers] = useState<PlayerStat[]>([]);
  const [assists, setAssists] = useState<PlayerStat[]>([]);
  const [allStats, setAllStats] = useState<Array<{ id: number; name: string; team: string; goals: number; assists: number; }>>([]);
  // G+A se calcula en render
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<number | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);

  // Cargar divisiones y ligas al montar
  useEffect(() => {
    async function fetchDivisionsAndSetDefault() {
      setLoading(true);
      try {
        const divisionsData = await leagueApi.getDivisionStructure();
        setDivisions(divisionsData);
        let defaultDivisionId = null;
        let defaultLeagueId = null;
        if (user?.teamId) {
          // Buscar la liga y división donde está el equipo del usuario
          const activeSeason = await leagueApi.getActiveSeason();
          let found = false;
          for (const division of divisionsData) {
            for (const league of division.leagues) {
              try {
                const teams = await leagueApi.getTeamsInLeague(league.id, activeSeason.id);
                if (teams.some(t => t.teamId === user.teamId)) {
                  defaultDivisionId = division.id;
                  defaultLeagueId = league.id;
                  found = true;
                  break;
                }
              } catch {}
            }
            if (found) break;
          }
        }
        // Si no se encuentra, usar la primera por defecto
        if (!defaultDivisionId && divisionsData.length > 0) {
          defaultDivisionId = divisionsData[0].id;
          defaultLeagueId = divisionsData[0].leagues[0]?.id || null;
        }
        setSelectedDivision(defaultDivisionId);
        setLeagues(defaultDivisionId ? divisionsData.find(d => d.id === defaultDivisionId)?.leagues || [] : []);
        setSelectedLeague(defaultLeagueId);
      } catch (e: any) {
        setError('Error al cargar divisiones/ligas');
      }
      setLoading(false);
    }
    fetchDivisionsAndSetDefault();
  }, [user]);

  // Cargar ligas al cambiar división
  useEffect(() => {
    if (selectedDivision && divisions.length > 0) {
      const div = divisions.find(d => d.id === selectedDivision);
      setLeagues(div?.leagues || []);
      if (div?.leagues && div.leagues.length > 0) {
        setSelectedLeague(div.leagues[0].id);
      }
    }
  }, [selectedDivision, divisions]);

  // Cargar estadísticas al cambiar liga
  useEffect(() => {
    async function fetchStats() {
      if (!selectedLeague) return;
      setLoading(true);
      setError(null);
      try {
        const [scorersRes, assistsRes, allStatsRes] = await Promise.all([
          fetch(`/api/stats/top-scorers?leagueId=${selectedLeague}`),
          fetch(`/api/stats/top-assists?leagueId=${selectedLeague}`),
          fetch(`/api/stats/all-stats?leagueId=${selectedLeague}`),
        ]);
        if (!scorersRes.ok || !assistsRes.ok || !allStatsRes.ok) {
          throw new Error('Error al cargar estadísticas');
        }
        const scorersData = await scorersRes.json();
        const assistsData = await assistsRes.json();
        const allStatsData = await allStatsRes.json();
        setScorers(Array.isArray(scorersData) ? scorersData : []);
        setAssists(Array.isArray(assistsData) ? assistsData : []);
        setAllStats(Array.isArray(allStatsData) ? allStatsData : []);
      } catch (e: any) {
        setError(e.message || 'Error desconocido');
        setScorers([]);
        setAssists([]);
        setAllStats([]);
      }
      setLoading(false);
    }
    fetchStats();
  }, [selectedLeague]);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 0 }}>
      <div style={{ display: 'flex', gap: 8, margin: '8px 0', justifyContent: 'center', flexWrap: 'wrap' }}>
        <select
          value={selectedDivision ?? ''}
          onChange={e => setSelectedDivision(Number(e.target.value))}
          style={{ fontSize: 16, padding: 4, minWidth: 120 }}
        >
          {divisions.map(div => (
            <option key={div.id} value={div.id}>{div.name}</option>
          ))}
        </select>
        {leagues.length > 1 && (
          <select
            value={selectedLeague ?? ''}
            onChange={e => setSelectedLeague(Number(e.target.value))}
            style={{ fontSize: 16, padding: 4, minWidth: 120 }}
          >
            {leagues.map(league => (
              <option key={league.id} value={league.id}>{league.name}</option>
            ))}
          </select>
        )}
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', margin: '32px 0' }}>
          <LoadingBallAnimation />
        </div>
      ) : error ? (
        <div style={{ color: 'red', textAlign: 'center', margin: '32px 0' }}>{error}</div>
      ) : (
        <>
          <section style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 20, margin: '8px 0' }}>🥇 Máximos goleadores</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 16 }}>
              <thead>
                <tr style={{ background: '#f7f7f7' }}>
                  <th style={{ textAlign: 'left', padding: 8 }}>Jugador</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Equipo</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Goles</th>
                </tr>
              </thead>
              <tbody>
                {scorers.slice(0, 20).map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>
                      {i+1}. <a href={`/player/${p.id}`} style={{ color: '#1976d2', cursor: 'pointer', textDecoration: 'underline' }}>{p.name}</a>
                    </td>
                    <td style={{ padding: 8 }}>{p.team}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>{p.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 20, margin: '8px 0' }}>🎯 Máximos asistentes</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 16 }}>
              <thead>
                <tr style={{ background: '#f7f7f7' }}>
                  <th style={{ textAlign: 'left', padding: 8 }}>Jugador</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Equipo</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Asistencias</th>
                </tr>
              </thead>
              <tbody>
                {assists.slice(0, 20).map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>
                      {i+1}. <a href={`/player/${p.id}`} style={{ color: '#1976d2', cursor: 'pointer', textDecoration: 'underline' }}>{p.name}</a>
                    </td>
                    <td style={{ padding: 8 }}>{p.team}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>{p.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h3 style={{ fontSize: 20, margin: '8px 0' }}>📊 Clasificación G+A (Goles + Asistencias)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 16 }}>
              <thead>
                <tr style={{ background: '#f7f7f7' }}>
                  <th style={{ textAlign: 'left', padding: 8 }}>Jugador</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Equipo</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>G+A</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Goles</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Asistencias</th>
                </tr>
              </thead>
              <tbody>
                {allStats.length > 0 ? (
                  allStats
                    .map(p => ({ ...p, total: (p.goals || 0) + (p.assists || 0) }))
                    .sort((a, b) => b.total - a.total || b.goals - a.goals)
                    .slice(0, 20)
                    .map((p, i) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: 8 }}>
                          {i+1}. <a href={`/player/${p.id}`} style={{ color: '#1976d2', cursor: 'pointer', textDecoration: 'underline' }}>{p.name}</a>
                        </td>
                        <td style={{ padding: 8 }}>{p.team}</td>
                        <td style={{ padding: 8, textAlign: 'right', fontWeight: 600 }}>{p.total}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{p.goals}</td>
                        <td style={{ padding: 8, textAlign: 'right' }}>{p.assists}</td>
                      </tr>
                    ))
                ) : (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 16 }}>Sin datos</td></tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
