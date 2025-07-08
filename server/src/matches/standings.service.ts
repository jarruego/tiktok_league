import { Injectable, Inject, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { 
  standingsTable, 
  matchTable, 
  teamTable,
  leagueTable,
  seasonTable,
  MatchStatus 
} from '../database/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { DATABASE_PROVIDER } from '../database/database.module';

export interface StandingData {
  position: number;
  team: {
    id: number;
    name: string;
    shortName: string | null;
    crest: string | null;
  };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface LeagueStandings {
  league: {
    id: number;
    name: string;
    groupCode: string;
  };
  division: {
    id: number;
    name: string;
    level: number;
  };
  standings: StandingData[];
  lastUpdated: string;
}

@Injectable()
export class StandingsService {
  private readonly logger = new Logger(StandingsService.name);

  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Recalcular clasificaciones para todas las ligas de una temporada
   */
  async recalculateStandingsForSeason(seasonId: number): Promise<void> {
    const db = this.databaseService.db;
    
    this.logger.log(`🔄 Recalculando clasificaciones para temporada ${seasonId}...`);
    
    // Obtener todas las ligas de la temporada
    const leagues = await db
      .select({
        leagueId: leagueTable.id,
        leagueName: leagueTable.name
      })
      .from(leagueTable)
      .innerJoin(matchTable, eq(matchTable.leagueId, leagueTable.id))
      .where(eq(matchTable.seasonId, seasonId))
      .groupBy(leagueTable.id, leagueTable.name);

    for (const league of leagues) {
      await this.recalculateStandingsForLeague(seasonId, league.leagueId);
    }

    this.logger.log(`✅ Clasificaciones recalculadas para ${leagues.length} ligas`);
  }

  /**
   * Recalcular clasificaciones para una liga específica
   */
  async recalculateStandingsForLeague(seasonId: number, leagueId: number): Promise<void> {
    const db = this.databaseService.db;
    
    // Obtener todos los equipos de la liga
    const teams = await db
      .select({
        teamId: teamTable.id,
        teamName: teamTable.name
      })
      .from(teamTable)
      .innerJoin(matchTable, eq(teamTable.id, matchTable.homeTeamId))
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          eq(matchTable.leagueId, leagueId)
        )
      )
      .groupBy(teamTable.id, teamTable.name);

    // También obtener equipos visitantes
    const awayTeams = await db
      .select({
        teamId: teamTable.id,
        teamName: teamTable.name
      })
      .from(teamTable)
      .innerJoin(matchTable, eq(teamTable.id, matchTable.awayTeamId))
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          eq(matchTable.leagueId, leagueId)
        )
      )
      .groupBy(teamTable.id, teamTable.name);

    // Combinar y eliminar duplicados
    const allTeamsMap = new Map();
    [...teams, ...awayTeams].forEach(team => {
      allTeamsMap.set(team.teamId, team);
    });
    const allTeams = Array.from(allTeamsMap.values());

    // Calcular estadísticas para cada equipo
    const teamStats = await Promise.all(
      allTeams.map(team => this.calculateTeamStats(seasonId, leagueId, team.teamId))
    );

    // Ordenar por puntos y luego por diferencia de goles
    teamStats.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.goalDifference - a.goalDifference;
    });

    // Eliminar clasificaciones existentes
    await db
      .delete(standingsTable)
      .where(
        and(
          eq(standingsTable.seasonId, seasonId),
          eq(standingsTable.leagueId, leagueId)
        )
      );

    // Insertar nuevas clasificaciones
    if (teamStats.length > 0) {
      const standingsData = teamStats.map((stats, index) => ({
        seasonId,
        leagueId,
        teamId: stats.teamId,
        position: index + 1,
        played: stats.played,
        won: stats.won,
        drawn: stats.drawn,
        lost: stats.lost,
        goalsFor: stats.goalsFor,
        goalsAgainst: stats.goalsAgainst,
        goalDifference: stats.goalDifference,
        points: stats.points,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      await db.insert(standingsTable).values(standingsData);
    }

    this.logger.log(`✅ Clasificación actualizada para liga ${leagueId}: ${teamStats.length} equipos`);
  }

  /**
   * Calcular estadísticas de un equipo específico
   */
  private async calculateTeamStats(seasonId: number, leagueId: number, teamId: number) {
    const db = this.databaseService.db;
    
    // Obtener partidos como local
    const homeMatches = await db
      .select({
        homeGoals: matchTable.homeGoals,
        awayGoals: matchTable.awayGoals,
        status: matchTable.status
      })
      .from(matchTable)
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          eq(matchTable.leagueId, leagueId),
          eq(matchTable.homeTeamId, teamId),
          eq(matchTable.status, MatchStatus.FINISHED)
        )
      );

    // Obtener partidos como visitante
    const awayMatches = await db
      .select({
        homeGoals: matchTable.homeGoals,
        awayGoals: matchTable.awayGoals,
        status: matchTable.status
      })
      .from(matchTable)
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          eq(matchTable.leagueId, leagueId),
          eq(matchTable.awayTeamId, teamId),
          eq(matchTable.status, MatchStatus.FINISHED)
        )
      );

    let played = 0;
    let won = 0;
    let drawn = 0;
    let lost = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    // Procesar partidos como local
    homeMatches.forEach(match => {
      if (match.homeGoals !== null && match.awayGoals !== null) {
        played++;
        goalsFor += match.homeGoals;
        goalsAgainst += match.awayGoals;

        if (match.homeGoals > match.awayGoals) {
          won++;
        } else if (match.homeGoals === match.awayGoals) {
          drawn++;
        } else {
          lost++;
        }
      }
    });

    // Procesar partidos como visitante
    awayMatches.forEach(match => {
      if (match.homeGoals !== null && match.awayGoals !== null) {
        played++;
        goalsFor += match.awayGoals;
        goalsAgainst += match.homeGoals;

        if (match.awayGoals > match.homeGoals) {
          won++;
        } else if (match.awayGoals === match.homeGoals) {
          drawn++;
        } else {
          lost++;
        }
      }
    });

    const goalDifference = goalsFor - goalsAgainst;
    const points = (won * 3) + (drawn * 1);

    return {
      teamId,
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDifference,
      points
    };
  }

  /**
   * Obtener clasificación de una liga
   */
  async getLeagueStandings(seasonId: number, leagueId: number): Promise<LeagueStandings | null> {
    const db = this.databaseService.db;
    
    // Obtener información de la liga
    const [leagueInfo] = await db
      .select({
        leagueId: leagueTable.id,
        leagueName: leagueTable.name,
        leagueGroupCode: leagueTable.groupCode,
        divisionId: leagueTable.divisionId,
        divisionName: sql<string>`d.name`,
        divisionLevel: sql<number>`d.level`
      })
      .from(leagueTable)
      .leftJoin(sql`divisions d`, sql`d.id = ${leagueTable.divisionId}`)
      .where(eq(leagueTable.id, leagueId));

    if (!leagueInfo) {
      return null;
    }

    // Obtener clasificaciones
    const standings = await db
      .select({
        position: standingsTable.position,
        played: standingsTable.played,
        won: standingsTable.won,
        drawn: standingsTable.drawn,
        lost: standingsTable.lost,
        goalsFor: standingsTable.goalsFor,
        goalsAgainst: standingsTable.goalsAgainst,
        goalDifference: standingsTable.goalDifference,
        points: standingsTable.points,
        updatedAt: standingsTable.updatedAt,
        teamId: teamTable.id,
        teamName: teamTable.name,
        teamShortName: teamTable.shortName,
        teamCrest: teamTable.crest
      })
      .from(standingsTable)
      .innerJoin(teamTable, eq(standingsTable.teamId, teamTable.id))
      .where(
        and(
          eq(standingsTable.seasonId, seasonId),
          eq(standingsTable.leagueId, leagueId)
        )
      )
      .orderBy(asc(standingsTable.position));

    return {
      league: {
        id: leagueInfo.leagueId,
        name: leagueInfo.leagueName,
        groupCode: leagueInfo.leagueGroupCode
      },
      division: {
        id: leagueInfo.divisionId,
        name: leagueInfo.divisionName,
        level: leagueInfo.divisionLevel
      },
      standings: standings.map(s => ({
        position: s.position,
        team: {
          id: s.teamId,
          name: s.teamName,
          shortName: s.teamShortName,
          crest: s.teamCrest
        },
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        goalsFor: s.goalsFor,
        goalsAgainst: s.goalsAgainst,
        goalDifference: s.goalDifference,
        points: s.points
      })),
      lastUpdated: standings.length > 0 ? standings[0].updatedAt.toISOString() : new Date().toISOString()
    };
  }

  /**
   * Obtener todas las clasificaciones de una temporada
   */
  async getAllStandingsForSeason(seasonId: number): Promise<LeagueStandings[]> {
    const db = this.databaseService.db;
    
    // Obtener todas las ligas que tienen partidos en esta temporada
    const leagues = await db
      .select({
        leagueId: leagueTable.id
      })
      .from(leagueTable)
      .innerJoin(matchTable, eq(matchTable.leagueId, leagueTable.id))
      .where(eq(matchTable.seasonId, seasonId))
      .groupBy(leagueTable.id);

    const allStandings = await Promise.all(
      leagues.map(league => this.getLeagueStandings(seasonId, league.leagueId))
    );

    return allStandings.filter(standings => standings !== null) as LeagueStandings[];
  }
}
