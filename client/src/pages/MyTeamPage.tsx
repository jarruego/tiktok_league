import React, { useEffect, useState } from 'react';
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
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [divisionName, setDivisionName] = useState<string | null>(null);
  const [nextMatches, setNextMatches] = useState<Match[]>([]);
  const [lastMatch, setLastMatch] = useState<Match | null>(null);

  useEffect(() => {
    if (!user?.teamId) return;

    // 1. Obtener temporada activa
    leagueApi.getActiveSeason().then(async (season) => {
      // 2. Buscar en todas las ligas/equipos dónde está el equipo del usuario
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
        // Mostrar ejemplo de standings
        if (standings && standings.length > 0) {
          // eslint-disable-next-line no-console
          console.log('Ejemplo de standings:', standings[0]);
        }
        // Buscar por varias claves posibles
        const myStanding = standings.find((s: any) => {
          const teamId = s.team_id ?? s.teamId ?? s.id ?? s.team?.id;
          return Number(teamId) === Number(user.teamId);
        });
        position = myStanding?.position;
        // eslint-disable-next-line no-console
        if (!myStanding) {
          console.warn('No se encontró el equipo en standings. user.teamId:', user.teamId, 'Standings:', standings);
        }
        // eslint-disable-next-line no-console
        console.log('Standings:', standings);
        console.log('MyStanding:', myStanding);
      }
      setLeague(foundLeague ? {
        id: foundLeague.id,
        name: foundLeague.name,
        position: position
      } : null);

      // 3. Buscar partidos del equipo en la temporada
      const matchesResp = await matchApi.getMatchesByTeam(Number(user.teamId), { seasonId: season.id, limit: 100 });
      const matches = matchesResp.matches || [];
      // Mostrar ejemplo de partido
      if (matches && matches.length > 0) {
        // eslint-disable-next-line no-console
        console.log('Ejemplo de partido:', matches[0]);
      }
      // DEBUG: mostrar todos los partidos devueltos
      // eslint-disable-next-line no-console
      console.log('Todos los partidos:', matches);
      // Próximos partidos: status 'scheduled', fechas futuras más próximas (sin límite)
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
      // Último partido: status 'finished', el más reciente por fecha
      const last = matches
        .filter((m: any) => m.status === 'finished')
        .sort((a: any, b: any) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())[0];

      // DEBUG: mostrar último partido
      // eslint-disable-next-line no-console
      console.log('Último partido:', last);

      setNextMatches(nextArr);
      setLastMatch(last ? {
        id: last.id,
        homeTeam: last.homeTeam?.name ?? last.homeTeam ?? '',
        awayTeam: last.awayTeam?.name ?? last.awayTeam ?? '',
        homeCrest: last.homeTeam?.crest ?? '',
        awayCrest: last.awayTeam?.crest ?? '',
        homeGoals: last.homeGoals,
        awayGoals: last.awayGoals,
        date: last.scheduledDate
      } : null);
    });
  }, [user]);

  if (!user?.teamId) {
    return <div>No tienes equipo asignado.</div>;
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
          <h2 style={{ fontSize: 26, margin: 0, fontWeight: 800, color: '#1e90ff', letterSpacing: 0.5 }}>{team?.name || 'Mi Equipo'}</h2>
        </div>
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
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>Último partido</h3>
        {lastMatch ? (
          <div style={{ width: '100%' }}>
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
      <div style={{
        padding: '10px',
        width: '95%',
        margin: '10px auto', 
        overflowX: 'hidden',
        border: '1px solid #eee',
        borderRadius: 8,
        background: '#fff',
      }}>
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
                  minWidth: 'min(100%, 280px)',
                  width: '100%',
                  maxWidth: 'calc(33% - 10px)', // 3 por fila en escritorio
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
    </div>
  );
};

export default MyTeamPage;
