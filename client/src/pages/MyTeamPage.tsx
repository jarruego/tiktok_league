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
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
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
      // Próximo partido: status 'scheduled', fecha futura más próxima
      const now = new Date();
      const next = matches
        .filter((m: any) => {
          const status = m.status;
          const date = new Date(m.scheduledDate);
          return status === 'scheduled' && date > now;
        })
        .sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())[0];
      // Último partido: status 'finished', el más reciente por fecha
      const last = matches
        .filter((m: any) => m.status === 'finished')
        .sort((a: any, b: any) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())[0];

      // DEBUG: mostrar último partido
      // eslint-disable-next-line no-console
      console.log('Último partido:', last);

      setNextMatch(next ? {
        id: next.id,
        homeTeam: next.homeTeam?.name ?? next.homeTeam ?? '',
        awayTeam: next.awayTeam?.name ?? next.awayTeam ?? '',
        homeCrest: next.homeTeam?.crest ?? '',
        awayCrest: next.awayTeam?.crest ?? '',
        homeGoals: next.homeGoals,
        awayGoals: next.awayGoals,
        date: next.scheduledDate
      } : null);
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
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
      {/* Cabecera: escudo y nombre del equipo */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        {team?.logoUrl && (
          <img src={team.logoUrl} alt="Escudo" style={{ width: 64, height: 64, marginRight: 16 }} />
        )}
        <h2>{team?.name || 'Mi Equipo'}</h2>
      </div>
      {/* Card: Liga y posición */}
      <div className="card" style={{ marginBottom: 16, padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
        <h3>Liga</h3>
        <div>{league?.name || 'Sin liga'}</div>
        <div>Posición: {league?.position ?? '-'}</div>
      </div>
      {/* Card: Próximo partido */}
      <div className="card" style={{ marginBottom: 16, padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
        <h3>Próximo partido</h3>
        {nextMatch ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
              {nextMatch.homeCrest && <img src={nextMatch.homeCrest} alt="Escudo local" style={{ width: 36, height: 36, objectFit: 'contain', background: '#fff', borderRadius: 4, border: '1px solid #eee' }} />}
              <span style={{ fontWeight: 600 }}>{nextMatch.homeTeam}</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 18 }}>vs</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-start' }}>
              <span style={{ fontWeight: 600 }}>{nextMatch.awayTeam}</span>
              {nextMatch.awayCrest && <img src={nextMatch.awayCrest} alt="Escudo visitante" style={{ width: 36, height: 36, objectFit: 'contain', background: '#fff', borderRadius: 4, border: '1px solid #eee' }} />}
            </div>
          </div>
        ) : (
          <div>No hay próximo partido programado.</div>
        )}
        {nextMatch && (
          <div style={{ textAlign: 'center', marginTop: 8, color: '#888' }}>
            {new Date(nextMatch.date).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}
      </div>
      {/* Card: Último partido */}
      <div className="card" style={{ marginBottom: 16, padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
        <h3>Último partido</h3>
        {lastMatch ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                {lastMatch.homeCrest && <img src={lastMatch.homeCrest} alt="Escudo local" style={{ width: 36, height: 36, objectFit: 'contain', background: '#fff', borderRadius: 4, border: '1px solid #eee' }} />}
                <span style={{ fontWeight: 600 }}>{lastMatch.homeTeam}</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: 18 }}>
                {typeof lastMatch.homeGoals === 'number' && typeof lastMatch.awayGoals === 'number'
                  ? `${lastMatch.homeGoals} - ${lastMatch.awayGoals}`
                  : 'vs'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-start' }}>
                <span style={{ fontWeight: 600 }}>{lastMatch.awayTeam}</span>
                {lastMatch.awayCrest && <img src={lastMatch.awayCrest} alt="Escudo visitante" style={{ width: 36, height: 36, objectFit: 'contain', background: '#fff', borderRadius: 4, border: '1px solid #eee' }} />}
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 8, color: '#888' }}>
              {new Date(lastMatch.date).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
        ) : (
          <div>No hay partidos jugados aún.</div>
        )}
      </div>
    </div>
  );
};

export default MyTeamPage;
