import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface Team {
  footballId: number;
  name: string;
  shortName?: string;
  crest?: string;
  playersCount?: number; // Cambiado a playersCount
}

interface League {
  competitionId: number;
  competitionName: string;
  competitionCode: string;
  season: string;
  teams: Team[];
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const [remoteSquadCounts, setRemoteSquadCounts] = useState<{[teamId:number]:number|null|undefined}>({});
  const [loadingRemote, setLoadingRemote] = useState<{[teamId:number]:boolean}>({});
  const remoteError = useRef<{[teamId:number]:string|undefined}>({});
  const [remoteCompPlayers, setRemoteCompPlayers] = useState<{[compId:number]:number|null|undefined}>({});
  const [loadingComp, setLoadingComp] = useState<{[compId:number]:boolean}>({});
  const compError = useRef<{[compId:number]:string|undefined}>({});
  const [importingComp, setImportingComp] = useState<{[compId:number]:boolean}>({});
  const [importResult, setImportResult] = useState<{[compId:number]:string|undefined}>({});
  const [showRemoteComps, setShowRemoteComps] = useState(false);
  const [remoteComps, setRemoteComps] = useState<any[]>([]);
  const [loadingRemoteComps, setLoadingRemoteComps] = useState(false);
  const [remoteCompsError, setRemoteCompsError] = useState<string|null>(null);
  const [showCachedComps, setShowCachedComps] = useState(false);
  const [cachedComps, setCachedComps] = useState<any[]>([]);
  const [loadingCachedComps, setLoadingCachedComps] = useState(false);
  const [cachedCompsError, setCachedCompsError] = useState<string|null>(null);

  useEffect(() => {
    const fetchLeagues = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/football-data/cache/leagues-with-teams`, {
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

  const fetchRemoteSquad = async (teamId:number) => {
    setLoadingRemote(lr => ({...lr, [teamId]:true}));
    try {
      const res = await axios.get(`${API_BASE_URL}/api/football-data/remote-team/${teamId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setRemoteSquadCounts(rsc => ({...rsc, [teamId]: res.data.squadCount}));
      remoteError.current[teamId] = undefined;
    } catch (err:any) {
      setRemoteSquadCounts(rsc => ({...rsc, [teamId]: undefined}));
      remoteError.current[teamId] = 'Error';
    } finally {
      setLoadingRemote(lr => ({...lr, [teamId]:false}));
    }
  };

  const fetchRemoteCompetitionPlayers = async (competitionId:number) => {
    setLoadingComp(lc => ({...lc, [competitionId]:true}));
    try {
      const res = await axios.get(`${API_BASE_URL}/api/football-data/remote-competition/${competitionId}/players-count`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setRemoteCompPlayers(rcp => ({...rcp, [competitionId]: res.data.totalPlayers}));
      compError.current[competitionId] = undefined;
    } catch (err:any) {
      setRemoteCompPlayers(rcp => ({...rcp, [competitionId]: undefined}));
      compError.current[competitionId] = 'Error';
    } finally {
      setLoadingComp(lc => ({...lc, [competitionId]:false}));
    }
  };

  const importRemoteCompetition = async (competitionId:number) => {
    setImportingComp(ic => ({...ic, [competitionId]:true}));
    setImportResult(ir => ({...ir, [competitionId]: undefined}));
    try {
      await axios.post(`${API_BASE_URL}/api/football-data/remote-competition/${competitionId}/import`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setImportResult(ir => ({...ir, [competitionId]: 'Importación completada'}));
    } catch (err:any) {
      setImportResult(ir => ({...ir, [competitionId]: 'Error en la importación'}));
    } finally {
      setImportingComp(ic => ({...ic, [competitionId]:false}));
    }
  };

  const fetchRemoteCompetitions = async () => {
    setLoadingRemoteComps(true);
    setRemoteCompsError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/football-data/remote-competitions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setRemoteComps(res.data);
      setShowRemoteComps(true);
    } catch (err:any) {
      setRemoteCompsError('Error al cargar competiciones remotas');
    } finally {
      setLoadingRemoteComps(false);
    }
  };

  useEffect(() => {
    const fetchCachedCompetitions = async () => {
      setLoadingCachedComps(true);
      setCachedCompsError(null);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/football-data/cache/competitions`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setCachedComps(res.data.competitions || []);
        setShowCachedComps(true);
      } catch (err:any) {
        setCachedCompsError('Error al cargar competiciones cacheadas');
      } finally {
        setLoadingCachedComps(false);
      }
    };
    if (token) fetchCachedCompetitions();
  }, [token]);

  if (loading) return <div>Cargando ligas...</div>;
  if (error) return <div style={{color:'red'}}>{error}</div>;

  return (
    <div style={{maxWidth:900, margin:'0 auto', padding:'2rem'}}>
      <h1>Ligas y equipos (cache football-data)</h1>
      {/* Cuadro de competiciones cacheadas y remotas al inicio */}
      <div style={{marginBottom:40, textAlign:'center'}}>
        {loadingCachedComps && <span style={{marginLeft:8}}>Cargando competiciones cacheadas...</span>}
        {cachedCompsError && <div style={{color:'red', marginTop:8}}>{cachedCompsError}</div>}
        {showCachedComps && cachedComps.length > 0 && (
          <div style={{margin:'24px auto', maxWidth:600, background:'#f3f3f3', border:'1px solid #ccc', borderRadius:8, padding:16}}>
            <h3>Competiciones en la cache local</h3>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#eee'}}>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Código</th>
                  <th>Temporada</th>
                </tr>
              </thead>
              <tbody>
                {cachedComps.map((c:any) => (
                  <tr key={c.competitionId}>
                    <td>{c.competitionId}</td>
                    <td>{c.competitionName}</td>
                    <td>{c.competitionCode}</td>
                    <td>{c.season}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button onClick={fetchRemoteCompetitions} disabled={loadingRemoteComps} style={{fontWeight:'bold', fontSize:16, padding:'8px 20px', marginTop:16}}>
          Ver Competiciones Remotas
        </button>
        {loadingRemoteComps && <span style={{marginLeft:8}}>Cargando...</span>}
        {remoteCompsError && <div style={{color:'red', marginTop:8}}>{remoteCompsError}</div>}
        {showRemoteComps && remoteComps.length > 0 && (
          <div style={{margin:'24px auto', maxWidth:600, background:'#f9f9f9', border:'1px solid #ddd', borderRadius:8, padding:16}}>
            <h3>Competiciones disponibles en la API remota</h3>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#eee'}}>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Código</th>
                  <th>País/Área</th>
                </tr>
              </thead>
              <tbody>
                {remoteComps.map((c:any) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.name}</td>
                    <td>{c.code}</td>
                    <td>{c.area}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Listado de ligas y equipos */}
      {leagues.map(league => (
        <div key={league.competitionId} style={{marginBottom:'2rem', border:'1px solid #eee', borderRadius:8, padding:'1rem'}}>
          <h2>{league.competitionName}</h2>
          <button onClick={() => fetchRemoteCompetitionPlayers(league.competitionId)} disabled={loadingComp[league.competitionId]} style={{marginBottom:8}}>
            Ver nº jugadores en API remota
          </button>
          {loadingComp[league.competitionId] && <span style={{marginLeft:8}}>...</span>}
          {typeof remoteCompPlayers[league.competitionId] === 'number' && !loadingComp[league.competitionId] && (
            <span style={{marginLeft:8}}>Total: {remoteCompPlayers[league.competitionId]}</span>
          )}
          {compError.current[league.competitionId] && <span style={{color:'red',marginLeft:8}}>Error</span>}
          <br />
          <button onClick={() => importRemoteCompetition(league.competitionId)} disabled={importingComp[league.competitionId]} style={{marginBottom:8, marginTop:4}}>
            Importar datos de API remota a cache
          </button>
          {importingComp[league.competitionId] && <span style={{marginLeft:8}}>...</span>}
          {importResult[league.competitionId] && <span style={{marginLeft:8}}>{importResult[league.competitionId]}</span>}
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
                <th style={{textAlign:'left'}}>Jug. Caché</th>
                <th style={{textAlign:'left'}}>Jug. Remoto</th>
              </tr>
            </thead>
            <tbody>
              {league.teams.map(team => (
                <tr key={team.footballId}>
                  <td>{team.footballId}</td>
                  <td>{team.name}</td>
                  <td>{team.shortName || '-'}</td>
                  <td>{team.crest ? <img src={team.crest} alt={team.name} style={{height:24}} /> : '-'}</td>
                  <td>{typeof team.playersCount === 'number' ? team.playersCount : '-'}</td>
                  <td>
                    <button onClick={() => fetchRemoteSquad(team.footballId)} disabled={loadingRemote[team.footballId]}>
                      Ver remoto
                    </button>
                    {loadingRemote[team.footballId] && <span style={{marginLeft:8}}>...</span>}
                    {typeof remoteSquadCounts[team.footballId] === 'number' && !loadingRemote[team.footballId] && (
                      <span style={{marginLeft:8}}>{remoteSquadCounts[team.footballId]}</span>
                    )}
                    {remoteError.current[team.footballId] && <span style={{color:'red',marginLeft:8}}>Error</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
