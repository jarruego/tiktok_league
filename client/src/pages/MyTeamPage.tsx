import React, { useEffect, useState } from 'react';
import { Modal, Input, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import LoadingBallAnimation from '../components/LoadingBallAnimation';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { leagueApi } from '../api/leagueApi';
import { matchApi } from '../api/matchApi';

interface Team {
  id: number;
  name: string;
  logoUrl?: string;
}
interface League {
  id: number;
  name: string;
  position?: number;
}
interface Match {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeGoals?: number;
  awayGoals?: number;
  date: string;
  homeCrest?: string;
  awayCrest?: string;
}


const MyTeamPage: React.FC = () => {
  // Asegura que setUser existe en el contexto
  const auth = useAuth ? useAuth() : { user: null };
  const user = auth.user;
  // Solo usar setUser si existe en el contexto
  const setUser = (auth && typeof (auth as any).setUser === 'function') ? (auth as any).setUser : undefined;
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [league, setLeague] = useState<League | null>(null);
  const [divisionName, setDivisionName] = useState<string | null>(null);
  const [nextMatches, setNextMatches] = useState<Match[]>([]);
  const [lastMatch, setLastMatch] = useState<Match | null>(null);
  const [finishedMatches, setFinishedMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Si el usuario no tiene teamId, intenta refrescar desde el backend
    if (!user?.teamId) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/auth/me`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data && data.teamId) {
              setUser && setUser(data);
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
      return;
    }

    // 1. Obtener temporada activa
    leagueApi.getActiveSeason().then(async (season) => {
      // 2. Obtener estructura de divisiones
      const divisionStructure = await leagueApi.getDivisionStructure();
      let foundTeam: any = null;
      let foundLeague: any = null;
      let foundLeagueId: number | null = null;

      for (const division of divisionStructure) {
        for (const league of division.leagues) {
          const teams = await leagueApi.getTeamsInLeague(league.id, season.id) as import('../types/league.types').ExtendedTeamInLeague[];
          const team = teams.find((t) => t.teamId === user.teamId);
          if (team) {
            foundTeam = team;
            foundLeague = league;
            foundLeagueId = league.id;
            setDivisionName(division.name);
            break;
          }
        }
        if (foundTeam) break;
      }

      setTeam(foundTeam ? {
        id: foundTeam.teamId,
        name: foundTeam.teamName,
        logoUrl: foundTeam.crest
      } : null);

      // Obtener posición real desde standings
      let position: number | undefined = undefined;
      if (foundLeagueId) {
        const standings = await matchApi.getLeagueStandings(foundLeagueId, season.id);
        const myStanding = standings.find((s: any) => {
          const teamId = s.team_id ?? s.teamId ?? s.id ?? s.team?.id;
          return Number(teamId) === Number(user.teamId);
        });
        position = myStanding?.position;
      }
      setLeague(foundLeague ? {
        id: foundLeague.id,
        name: foundLeague.name,
        position: position
      } : null);

      // 3. Buscar partidos del equipo en la temporada
      const matchesResp = await matchApi.getMatchesByTeam(Number(user.teamId), { seasonId: season.id, limit: 100 });
      const matches = matchesResp.matches || [];
      const now = new Date();
      const nextArr = matches
        .filter((m: any) => {
          const status = m.status;
          const date = new Date(m.scheduledDate);
          return status === 'scheduled' && date > now;
        })
        .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
        .map((next: any) => ({
          id: next.id,
          homeTeam: next.homeTeam?.name ?? next.homeTeam ?? '',
          awayTeam: next.awayTeam?.name ?? next.awayTeam ?? '',
          homeCrest: next.homeTeam?.crest ?? '',
          awayCrest: next.awayTeam?.crest ?? '',
          homeGoals: next.homeGoals,
          awayGoals: next.awayGoals,
          date: next.scheduledDate
        }));
      const finishedArr = matches
        .filter((m: any) => m.status === 'finished')
        .sort((a: any, b: any) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())
        .map((fin: any) => ({
          id: fin.id,
          homeTeam: fin.homeTeam?.name ?? fin.homeTeam ?? '',
          awayTeam: fin.awayTeam?.name ?? fin.awayTeam ?? '',
          homeCrest: fin.homeTeam?.crest ?? '',
          awayCrest: fin.awayTeam?.crest ?? '',
          homeGoals: fin.homeGoals,
          awayGoals: fin.awayGoals,
          date: fin.scheduledDate
        }));
      const last = finishedArr[0];

      if (!cancelled) {
        setNextMatches(nextArr);
        setFinishedMatches(finishedArr);
        setLastMatch(last ? {
          id: last.id,
          homeTeam: last.homeTeam,
          awayTeam: last.awayTeam,
          homeCrest: last.homeCrest,
          awayCrest: last.awayCrest,
          homeGoals: last.homeGoals,
          awayGoals: last.awayGoals,
          date: last.date
        } : null);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [user, setUser]);

  useEffect(() => {
    if (user && (!user.teamId || typeof user.teamId !== 'number')) {
      navigate('/welcome', { replace: true });
    }
  }, [user, navigate]);


  if (loading) {
    return <LoadingBallAnimation text="Cargando datos..." />;
  }
  if (!user?.teamId) {
    return null;
  }

  return (
    <div style={{ width: '100vw', minHeight: '100vh', boxSizing: 'border-box', background: '#fafbfc', padding: 0, margin: 0 }}>
      {/* Cabecera destacada: escudo y nombre del equipo + card liga */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <div style={{
          width: '100%',
          border: '1px solid #eee',
          borderRadius: 12,
          background: '#fff',
          padding: '18px 0 10px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {team?.logoUrl && (
            <img src={team.logoUrl} alt="Escudo" style={{ width: 56, height: 56, marginRight: 16, background: '#fff' }} />
          )}
          <h2 style={{ fontSize: 26, margin: 0, fontWeight: 800, color: '#1e90ff', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8 }}>
            {team?.name || 'Mi Equipo'}
            {team && (
              <EditOutlined
                style={{ color: '#888', fontSize: 20, marginLeft: 8, cursor: 'pointer' }}
                title="Editar nombre del equipo"
                onClick={() => {
                  setEditName(team.name);
                  setEditModalOpen(true);
                }}
              />
            )}
          </h2>
        </div>
      {/* Modal para editar nombre del equipo */}
      <Modal
        title="Editar nombre del equipo"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={async () => {
          setEditLoading(true);
          try {
            // Llama a la API para actualizar el nombre del equipo
            // Se asume un endpoint: leagueApi.updateTeamName(teamId, nuevoNombre)
            if (!team) throw new Error('No hay equipo');
            await leagueApi.updateTeamName(team.id, editName);
            setTeam(prev => prev ? { ...prev, name: editName } : prev);
            message.success('Nombre actualizado correctamente');
            setEditModalOpen(false);
          } catch (err) {
            message.error('Error al actualizar el nombre');
          } finally {
            setEditLoading(false);
          }
        }}
        okText="Guardar"
        cancelText="Cancelar"
        confirmLoading={editLoading}
      >
        <Input
          value={editName}
          onChange={e => setEditName(e.target.value)}
          maxLength={30}
          placeholder="Nuevo nombre del equipo"
        />
      </Modal>
        {/* Card: Liga y posición destacada y enlazable */}
        {league && divisionName ? (
          <a
            href={`/divisions?teamId=${team?.id}`}
            style={{
              width: '100%',
              textDecoration: 'none',
              display: 'block',
              border: '1px solid #eee',
              borderRadius: 12,
              background: '#fff',
              padding: '18px 0 18px 0',
              marginTop: 0,
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'box-shadow 0.2s',
            }}
            target="_self"
          >
            <div style={{ fontSize: 32, fontWeight: 900, color: '#222', marginBottom: 0, marginTop: 8 }}>
              {typeof league.position === 'number' ? `${league.position}ª Posición` : 'Sin posición'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e90ff', marginBottom: 2 }}>
              {league.name}
            </div>
          </a>
        ) : (
          <div style={{ width: '100%', borderRadius: 16, background: '#fff', border: '1px solid #eee', padding: '18px 0', textAlign: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>Liga</h3>
            <div>{league?.name || 'Sin liga'}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#222', marginTop: 8 }}>-</div>
          </div>
        )}
      </div>
      {/* Card: Último partido */}
      <div style={{
        padding: '20px 10px',
        border: '2px solid #90caff',
        borderRadius: 14,
        background: '#f6faff',
        margin: '10px auto',
        width: '95%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxShadow: '0 2px 12px 0 rgba(30,144,255,0.07)',
        transition: 'box-shadow 0.2s',
      }}>
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 8 }}>
          Último partido
          <a
            href="#partidos-finalizados"
            style={{ fontSize: 13, fontWeight: 400, color: '#1e90ff', textDecoration: 'underline', marginLeft: 6 }}
            onClick={e => {
              e.preventDefault();
              const el = document.getElementById('partidos-finalizados');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            (Ver todos)
          </a>
        </h3>
        {lastMatch ? (
          <div
            style={{ width: '100%', cursor: 'pointer' }}
            onClick={() => navigate(`/match/${lastMatch.id}`)}
            title="Ver detalle del partido"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, minHeight: 60, margin: '18px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                {lastMatch.homeCrest && <img src={lastMatch.homeCrest} alt="Escudo local" style={{ width: 44, height: 44, objectFit: 'contain', background: '#fff' }} />}
                <span style={{ fontWeight: 700, fontSize: 20, marginLeft: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#222' }}>{lastMatch.homeTeam}</span>
              </div>
              <span style={{ fontWeight: 900, fontSize: 28, margin: '0 16px', minWidth: 48, textAlign: 'center', color: '#1e90ff' }}>
                {typeof lastMatch.homeGoals === 'number' && typeof lastMatch.awayGoals === 'number'
                  ? `${lastMatch.homeGoals} - ${lastMatch.awayGoals}`
                  : 'vs'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-start', minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 20, marginRight: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#222' }}>{lastMatch.awayTeam}</span>
                {lastMatch.awayCrest && <img src={lastMatch.awayCrest} alt="Escudo visitante" style={{ width: 44, height: 44, objectFit: 'contain', background: '#fff' }} />}
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 8, color: '#1e90ff', fontSize: 15, fontWeight: 600, letterSpacing: 0.2 }}>
              {new Date(lastMatch.date).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
        ) : (
          <div>No hay partidos jugados aún.</div>
        )}
      </div>
      {/* Card: Próximos partidos */}
      <div
        style={{
          padding: '10px',
          width: '95%',
          margin: '10px auto',
          overflowX: 'hidden',
          border: '1px solid #eee',
          borderRadius: 8,
          background: '#fff',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 24, marginBottom: 6, textAlign: 'center' }}>Próximos partidos</h3>
        {nextMatches.length > 0 ? (
          <div
            style={{
              padding: '0px 10px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'flex-start',
              width: '100%',
              boxSizing: 'border-box',
              marginLeft: 0,
              marginRight: 0,
            }}
          >
            {nextMatches.map((match) => (
              <div
                key={match.id}
                className="card"
                style={{
                  cursor: 'pointer',
                  minWidth: 'min(100%, 280px)',
                  width: '100%',
                  maxWidth: 'calc(33% - 10px)',
                  flex: '1 1 320px',
                  padding: '8px 4px',
                  border: '1px solid #eee',
                  borderRadius: 8,
                  background: '#fff',
                  marginBottom: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  boxSizing: 'border-box',
                }}
                onClick={() => navigate(`/match/${match.id}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 48 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                    {match.homeCrest && <img src={match.homeCrest} alt="Escudo local" style={{ width: 32, height: 32, objectFit: 'contain', background: '#fff', borderRadius: 4, border: '1px solid #eee' }} />}
                    <span style={{ fontWeight: 600, fontSize: 15, marginLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.homeTeam}</span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 16, margin: '0 8px', minWidth: 28, textAlign: 'center' }}>vs</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-start', minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 15, marginRight: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.awayTeam}</span>
                    {match.awayCrest && <img src={match.awayCrest} alt="Escudo visitante" style={{ width: 32, height: 32, objectFit: 'contain', background: '#fff', borderRadius: 4, border: '1px solid #eee' }} />}
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginTop: 4, color: '#888', fontSize: 11 }}>
                  {new Date(match.date).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'red', fontSize: 18 }}>No quedan partidos por jugar.</div>
        )}
        <style>{`
          @media (max-width: 600px) {
            .card {
              min-width: 100% !important;
              max-width: 100% !important;
              width: 100% !important;
              flex-basis: 100% !important;
            }
          }
          @media (min-width: 601px) and (max-width: 900px) {
            .card {
              max-width: calc(50% - 10px) !important;
              flex-basis: 48% !important;
            }
          }
          @media (min-width: 901px) and (max-width: 1200px) {
            .card {
              max-width: calc(33% - 10px) !important;
              flex-basis: 32% !important;
            }
          }
          @media (min-width: 1201px) {
            .card {
              max-width: calc(20% - 10px) !important;
              flex-basis: 19% !important;
            }
          }
        `}</style>
      </div>

      {/* Card: Partidos Finalizados */}
      <div style={{
        padding: '10px',
        width: '95%',
        margin: '10px auto',
        overflowX: 'hidden',
        border: '1px solid #eee',
        borderRadius: 8,
        background: '#fff',
      }}>
        <h3 id="partidos-finalizados" style={{ margin: 0, fontSize: 24, marginBottom: 6, textAlign: 'center' }}>Partidos Finalizados</h3>
        {finishedMatches.length > 0 ? (
          <div            
            style={{
              padding: '0px 10px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'flex-start',
              width: '100%',
              boxSizing: 'border-box',
              marginLeft: 0,
              marginRight: 0,
            }}
          >
            {finishedMatches.map((match) => (
              <div
                key={match.id}
                className="card"
                style={{ cursor: 'pointer', ...{
                  minWidth: 'min(100%, 280px)',
                  width: '100%',
                  maxWidth: 'calc(33% - 10px)',
                  flex: '1 1 320px',
                  padding: '8px 4px',
                  border: '1px solid #eee',
                  borderRadius: 8,
                  background: '#fff',
                  marginBottom: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  boxSizing: 'border-box',
                } }}
                onClick={() => navigate(`/match/${match.id}`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 48 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
                    {match.homeCrest && <img src={match.homeCrest} alt="Escudo local" style={{ width: 32, height: 32, objectFit: 'contain', background: '#fff', borderRadius: 4, border: '1px solid #eee' }} />}
                    <span style={{ fontWeight: 600, fontSize: 15, marginLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.homeTeam}</span>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 16, margin: '0 8px', minWidth: 28, textAlign: 'center' }}>
                    {typeof match.homeGoals === 'number' && typeof match.awayGoals === 'number'
                      ? `${match.homeGoals} - ${match.awayGoals}`
                      : 'vs'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-start', minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: 15, marginRight: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{match.awayTeam}</span>
                    {match.awayCrest && <img src={match.awayCrest} alt="Escudo visitante" style={{ width: 32, height: 32, objectFit: 'contain', background: '#fff', borderRadius: 4, border: '1px solid #eee' }} />}
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginTop: 4, color: '#888', fontSize: 11 }}>
                  {new Date(match.date).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#888', fontSize: 16 }}>No hay partidos finalizados.</div>
        )}
        {/* Reutiliza el mismo CSS responsivo que la card anterior */}
      </div>
    </div>
  );
};

export default MyTeamPage;
