import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface Team {
  footballId: number;
  name: string;
  shortName?: string;
  crest?: string;
}

interface League {
  competitionId: number;
  competitionName: string;
  competitionCode: string;
  season: string;
  teams: Team[];
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  useEffect(() => {
    const fetchLeagues = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get('/api/football-data/cache/leagues-with-teams', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setLeagues(res.data.leagues || []);
      } catch (err: any) {
        setError('Error cargando las ligas');
      } finally {
        setLoading(false);
      }
    };
    fetchLeagues();
  }, [token]);

  if (loading) return <div>Cargando ligas...</div>;
  if (error) return <div style={{color:'red'}}>{error}</div>;

  return (
    <div style={{maxWidth:900, margin:'0 auto', padding:'2rem'}}>
      <h1>Ligas y equipos (cache football-data)</h1>
      {leagues.map(league => (
        <div key={league.competitionId} style={{marginBottom:'2rem', border:'1px solid #eee', borderRadius:8, padding:'1rem'}}>
          <h2>{league.competitionName}</h2>
          <div>ID Competición: {league.competitionId}</div>
          <div>Id Temporada: {league.season}</div>
          <div>Equipos: {league.teams.length}</div>
          <table style={{width:'100%', marginTop:'1rem', borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#f5f5f5'}}>
                <th style={{textAlign:'left'}}>ID</th>
                <th style={{textAlign:'left'}}>Nombre</th>
                <th style={{textAlign:'left'}}>Short</th>
                <th style={{textAlign:'left'}}>Crest</th>
              </tr>
            </thead>
            <tbody>
              {league.teams.map(team => (
                <tr key={team.footballId}>
                  <td>{team.footballId}</td>
                  <td>{team.name}</td>
                  <td>{team.shortName || '-'}</td>
                  <td>{team.crest ? <img src={team.crest} alt={team.name} style={{height:24}} /> : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
