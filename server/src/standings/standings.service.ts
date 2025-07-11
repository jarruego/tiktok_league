import { Injectable, Inject, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { 
  standingsTable, 
  matchTable, 
  teamTable,
  leagueTable,
  seasonTable,
  teamLeagueAssignmentTable,
  divisionTable,
  MatchStatus 
} from '../database/schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
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
  status: 'SAFE' | 'PROMOTES' | 'PLAYOFF' | 'RELEGATES' | 'TOURNAMENT';
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

export interface TeamStats {
  teamId: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  followers: number;
}

export interface DirectMatchResult {
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
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
    
    // Usar la función unificada de cálculo de clasificaciones CON consecuencias
    // Esto asegura que las marcas de ascenso/descenso/playoff/torneo se apliquen automáticamente
    const result = await this.calculateStandingsWithConsequences(seasonId, leagueId, true);
    const sortedTeamStats = result.standings;

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
    if (sortedTeamStats.length > 0) {
      const standingsData = sortedTeamStats.map((stats) => ({
        seasonId,
        leagueId,
        teamId: stats.teamId,
        position: stats.position,
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

    this.logger.log(`✅ Clasificación actualizada para liga ${leagueId}: ${sortedTeamStats.length} equipos`);
  }

  /**
   * Calcular estadísticas de un equipo específico
   */
  private async calculateTeamStats(seasonId: number, leagueId: number, teamId: number): Promise<TeamStats> {
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

    // Obtener seguidores (followers) del equipo
    const [{ followers }] = await db
      .select({
        followers: teamTable.followers
      })
      .from(teamTable)
      .where(eq(teamTable.id, teamId));

    return {
      teamId,
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDifference,
      points,
      followers: followers || 0
    };
  }

  /**
   * Obtener clasificación de una liga
   */
  async getLeagueStandings(seasonId: number, leagueId: number): Promise<LeagueStandings | null> {
    const db = this.databaseService.db;
    
    this.logger.log(`🔍 getLeagueStandings llamado para season ${seasonId}, league ${leagueId}`);
    
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

    // Usar la función unificada para calcular clasificaciones en tiempo real
    const sortedTeamStats = await this.calculateStandings(seasonId, leagueId);
    
    this.logger.log(`📊 Aplicando lógica unificada de desempate para ${sortedTeamStats.length} equipos`);

    // Obtener información adicional de los equipos (crest, estado, etc.)
    const teamDetails = await db
      .select({
        teamId: teamTable.id,
        teamName: teamTable.name,
        teamShortName: teamTable.shortName,
        teamCrest: teamTable.crest,
        promotedNextSeason: teamLeagueAssignmentTable.promotedNextSeason,
        relegatedNextSeason: teamLeagueAssignmentTable.relegatedNextSeason,
        playoffNextSeason: teamLeagueAssignmentTable.playoffNextSeason,
        qualifiedForTournament: teamLeagueAssignmentTable.qualifiedForTournament
      })
      .from(teamTable)
      .leftJoin(
        teamLeagueAssignmentTable,
        and(
          eq(teamLeagueAssignmentTable.teamId, teamTable.id),
          eq(teamLeagueAssignmentTable.seasonId, seasonId),
          eq(teamLeagueAssignmentTable.leagueId, leagueId)
        )
      )
      .where(inArray(teamTable.id, sortedTeamStats.map(s => s.teamId)));

    const teamDetailsMap = new Map(teamDetails.map(t => [t.teamId, t]));

    // Mapear a StandingData con posiciones dinámicas
    const standings = sortedTeamStats.map((stats) => {
      const details = teamDetailsMap.get(stats.teamId);
      
      // Determinar el estado del equipo
      const status = this.determineTeamStatus(
        details?.promotedNextSeason || false,
        details?.relegatedNextSeason || false,
        details?.playoffNextSeason || false,
        details?.qualifiedForTournament || false
      );
      
      return {
        position: stats.position,
        team: {
          id: stats.teamId,
          name: stats.teamName,
          shortName: details?.teamShortName || null,
          crest: details?.teamCrest || null
        },
        played: stats.played,
        won: stats.won,
        drawn: stats.drawn,
        lost: stats.lost,
        goalsFor: stats.goalsFor,
        goalsAgainst: stats.goalsAgainst,
        goalDifference: stats.goalDifference,
        points: stats.points,
        status: status
      };
    });

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
      standings: standings,
      lastUpdated: new Date().toISOString()
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

  /**
   * Función principal unificada para calcular clasificaciones con criterios de desempate
   * Esta función se usa tanto para clasificaciones dinámicas como persistentes
   * 
   * Criterios de desempate (en orden):
   * 1. Puntos totales
   * 2. Para equipos empatados:
   *    - Si son 2 equipos: enfrentamientos directos (puntos, diferencia, goles a favor)
   *    - Si son 3+: mini-liga de enfrentamientos directos
   * 3. Diferencia de goles general
   * 4. Goles a favor general
   * 5. Número de seguidores
   * 6. Sorteo (aleatorio)
   */
  async calculateStandings(seasonId: number, leagueId: number): Promise<Array<{ teamId: number; teamName: string; position: number; points: number; goalDifference: number; goalsFor: number; goalsAgainst: number; played: number; won: number; drawn: number; lost: number; followers: number }>> {
    const db = this.databaseService.db;
    
    // Obtener todos los partidos completados de la liga
    const completedMatches = await db
      .select()
      .from(matchTable)
      .where(
        and(
          eq(matchTable.leagueId, leagueId),
          eq(matchTable.seasonId, seasonId),
          eq(matchTable.isPlayoff, false),
          sql`${matchTable.homeGoals} IS NOT NULL AND ${matchTable.awayGoals} IS NOT NULL`
        )
      );
    
    // Obtener todos los equipos de la liga
    const teamsInLeague = await db
      .select({
        teamId: teamTable.id,
        teamName: teamTable.name,
        followers: teamTable.followers
      })
      .from(teamTable)
      .innerJoin(teamLeagueAssignmentTable, eq(teamTable.id, teamLeagueAssignmentTable.teamId))
      .where(
        and(
          eq(teamLeagueAssignmentTable.leagueId, leagueId),
          eq(teamLeagueAssignmentTable.seasonId, seasonId)
        )
      );
    
    // Calcular estadísticas por equipo
    const teamStats = new Map();
    
    // Inicializar estadísticas para todos los equipos
    teamsInLeague.forEach(team => {
      teamStats.set(team.teamId, {
        teamId: team.teamId,
        teamName: team.teamName,
        points: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        played: 0,
        followers: team.followers || 0
      });
    });
    
    // Procesar partidos
    completedMatches.forEach(match => {
      if (match.homeGoals === null || match.awayGoals === null) return;
      
      const homeStats = teamStats.get(match.homeTeamId);
      const awayStats = teamStats.get(match.awayTeamId);
      
      if (!homeStats || !awayStats) return;
      
      homeStats.goalsFor += match.homeGoals;
      homeStats.goalsAgainst += match.awayGoals;
      homeStats.played++;
      
      awayStats.goalsFor += match.awayGoals;
      awayStats.goalsAgainst += match.homeGoals;
      awayStats.played++;
      
      if (match.homeGoals > match.awayGoals) {
        homeStats.won++;
        homeStats.points += 3;
        awayStats.lost++;
      } else if (match.homeGoals < match.awayGoals) {
        awayStats.won++;
        awayStats.points += 3;
        homeStats.lost++;
      } else {
        homeStats.drawn++;
        awayStats.drawn++;
        homeStats.points += 1;
        awayStats.points += 1;
      }
    });
    
    // Convertir a array y añadir diferencia de goles
    let standings = Array.from(teamStats.values()).map(stats => ({
      ...stats,
      goalDifference: stats.goalsFor - stats.goalsAgainst
    }));

    // Aplicar lógica de desempate unificada
    standings = await this.applyUnifiedTiebreakingRules(seasonId, leagueId, standings, completedMatches);

    // Asignar posiciones
    standings.forEach((team, index) => {
      team.position = index + 1;
    });

    this.logger.log(`Clasificación calculada para liga ${leagueId}: ${standings.length} equipos`);
    return standings;
  }

  /**
   * Aplicar reglas de desempate según el orden establecido:
   * 1. Puntos totales
   * 2. Para equipos empatados: enfrentamientos directos
   * 3. Diferencia de goles general
   * 4. Goles a favor general
   * 5. Número de seguidores
   * 6. Sorteo (aleatorio)
   */
  private async applyUnifiedTiebreakingRules(
    seasonId: number, 
    leagueId: number, 
    teamStats: any[], 
    completedMatches: any[]
  ): Promise<any[]> {
    // Agrupar por puntos
    const groupsByPoints = new Map<number, any[]>();
    teamStats.forEach(team => {
      if (!groupsByPoints.has(team.points)) groupsByPoints.set(team.points, []);
      groupsByPoints.get(team.points)!.push(team);
    });

    // Para cada grupo de equipos empatados a puntos, aplicar criterios de desempate
    let sortedStandings: any[] = [];
    for (const points of Array.from(groupsByPoints.keys()).sort((a, b) => b - a)) {
      const group = groupsByPoints.get(points);
      if (!group || group.length === 0) continue;
      
      if (group.length === 1) {
        sortedStandings.push(group[0]);
      } else if (group.length === 2) {
        // CASO ESPECIAL: SOLO DOS EQUIPOS EMPATADOS
        const [teamA, teamB] = group;
        const sortedPair = await this.resolveTwoTeamTie(teamA, teamB, completedMatches);
        sortedStandings.push(...sortedPair);
      } else {
        // 3 o más equipos empatados: mini-liga de enfrentamientos directos
        const sortedGroup = await this.resolveMultiTeamTie(group, completedMatches);
        sortedStandings.push(...sortedGroup);
      }
    }

    return sortedStandings;
  }

  /**
   * Resolver empate entre exactamente dos equipos
   */
  private async resolveTwoTeamTie(teamA: any, teamB: any, completedMatches: any[]): Promise<any[]> {
    // Buscar los partidos directos entre estos dos equipos
    const directMatches = completedMatches.filter(
      m => (m.homeTeamId === teamA.teamId && m.awayTeamId === teamB.teamId) ||
           (m.homeTeamId === teamB.teamId && m.awayTeamId === teamA.teamId)
    );
    
    let pointsA = 0, pointsB = 0, goalDiffA = 0, goalDiffB = 0, goalsForA = 0, goalsForB = 0;
    
    directMatches.forEach(m => {
      if (typeof m.homeGoals !== 'number' || typeof m.awayGoals !== 'number') return;
      
      // Para el equipo A
      if (m.homeTeamId === teamA.teamId && m.awayTeamId === teamB.teamId) {
        goalsForA += m.homeGoals;
        goalsForB += m.awayGoals;
        goalDiffA += m.homeGoals - m.awayGoals;
        goalDiffB += m.awayGoals - m.homeGoals;
        if (m.homeGoals > m.awayGoals) pointsA += 3;
        else if (m.homeGoals < m.awayGoals) pointsB += 3;
        else { pointsA += 1; pointsB += 1; }
      } else if (m.homeTeamId === teamB.teamId && m.awayTeamId === teamA.teamId) {
        goalsForB += m.homeGoals;
        goalsForA += m.awayGoals;
        goalDiffB += m.homeGoals - m.awayGoals;
        goalDiffA += m.awayGoals - m.homeGoals;
        if (m.homeGoals > m.awayGoals) pointsB += 3;
        else if (m.homeGoals < m.awayGoals) pointsA += 3;
        else { pointsA += 1; pointsB += 1; }
      }
    });
    
    // Aplicar criterios de desempate
    // 1. Puntos en enfrentamientos directos
    if (pointsA !== pointsB) {
      return pointsA > pointsB ? [teamA, teamB] : [teamB, teamA];
    }
    // 2. Diferencia de goles en enfrentamientos directos
    if (goalDiffA !== goalDiffB) {
      return goalDiffA > goalDiffB ? [teamA, teamB] : [teamB, teamA];
    }
    // 3. Goles a favor en enfrentamientos directos
    if (goalsForA !== goalsForB) {
      return goalsForA > goalsForB ? [teamA, teamB] : [teamB, teamA];
    }
    // 4. Diferencia de goles general
    if (teamA.goalDifference !== teamB.goalDifference) {
      return teamA.goalDifference > teamB.goalDifference ? [teamA, teamB] : [teamB, teamA];
    }
    // 5. Goles a favor general
    if (teamA.goalsFor !== teamB.goalsFor) {
      return teamA.goalsFor > teamB.goalsFor ? [teamA, teamB] : [teamB, teamA];
    }
    // 6. Seguidores
    if ((teamA.followers || 0) !== (teamB.followers || 0)) {
      return (teamA.followers || 0) > (teamB.followers || 0) ? [teamA, teamB] : [teamB, teamA];
    }
    // 7. Sorteo (aleatorio)
    return Math.random() > 0.5 ? [teamA, teamB] : [teamB, teamA];
  }

  /**
   * Resolver empate entre 3 o más equipos usando mini-liga
   */
  private async resolveMultiTeamTie(group: any[], completedMatches: any[]): Promise<any[]> {
    const ids = group.map(t => t.teamId);
    const directMatches = completedMatches.filter(m => ids.includes(m.homeTeamId) && ids.includes(m.awayTeamId));
    
    // Calcular mini-liga de enfrentamientos directos
    const directStats = new Map<number, { points: number; goalDiff: number; goalsFor: number; followers: number }>();
    group.forEach(t => directStats.set(t.teamId, { 
      points: 0, 
      goalDiff: 0, 
      goalsFor: 0, 
      followers: t.followers || 0 
    }));
    
    directMatches.forEach(m => {
      if (typeof m.homeGoals !== 'number' || typeof m.awayGoals !== 'number') return;
      
      // Home team
      if (directStats.has(m.homeTeamId)) {
        let s = directStats.get(m.homeTeamId)!;
        s.goalsFor += m.homeGoals;
        s.goalDiff += m.homeGoals - m.awayGoals;
        if (m.homeGoals > m.awayGoals) s.points += 3;
        else if (m.homeGoals === m.awayGoals) s.points += 1;
      }
      
      // Away team
      if (directStats.has(m.awayTeamId)) {
        let s = directStats.get(m.awayTeamId)!;
        s.goalsFor += m.awayGoals;
        s.goalDiff += m.awayGoals - m.homeGoals;
        if (m.awayGoals > m.homeGoals) s.points += 3;
        else if (m.awayGoals === m.homeGoals) s.points += 1;
      }
    });
    
    // Ordenar el grupo por criterios
    group.sort((a, b) => {
      // 1. Puntos en enfrentamientos directos
      if (directStats.get(b.teamId)!.points !== directStats.get(a.teamId)!.points)
        return directStats.get(b.teamId)!.points - directStats.get(a.teamId)!.points;
      // 2. Diferencia de goles en enfrentamientos directos
      if (directStats.get(b.teamId)!.goalDiff !== directStats.get(a.teamId)!.goalDiff)
        return directStats.get(b.teamId)!.goalDiff - directStats.get(a.teamId)!.goalDiff;
      // 3. Goles a favor en enfrentamientos directos
      if (directStats.get(b.teamId)!.goalsFor !== directStats.get(a.teamId)!.goalsFor)
        return directStats.get(b.teamId)!.goalsFor - directStats.get(a.teamId)!.goalsFor;
      // 4. Diferencia de goles general
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      // 5. Goles a favor general
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      // 6. Seguidores
      if ((b.followers || 0) !== (a.followers || 0))
        return (b.followers || 0) - (a.followers || 0);
      // 7. Sorteo (aleatorio)
      return Math.random() - 0.5;
    });
    
    return group;
  }

  /**
   * Determinar el estado del equipo basado en los campos booleanos de asignación
   */
  private determineTeamStatus(
    promotedNextSeason: boolean,
    relegatedNextSeason: boolean,
    playoffNextSeason: boolean,
    qualifiedForTournament: boolean
  ): 'SAFE' | 'PROMOTES' | 'PLAYOFF' | 'RELEGATES' | 'TOURNAMENT' {
    if (promotedNextSeason) return 'PROMOTES';
    if (relegatedNextSeason) return 'RELEGATES';
    if (playoffNextSeason) return 'PLAYOFF';
    if (qualifiedForTournament) return 'TOURNAMENT';
    return 'SAFE';
  }

  /**
   * Calcula clasificaciones y aplica automáticamente las consecuencias según la división
   * (ascensos, descensos, playoffs, torneos)
   * 
   * @param seasonId ID de la temporada
   * @param leagueId ID de la liga
   * @param applyConsequences Si debe aplicar las marcas automáticamente (por defecto true)
   * @param resetPromotionFlag Si debe resetear el flag de ascenso directo (por defecto true)
   * @returns Clasificaciones con información de consecuencias aplicadas
   */
  async calculateStandingsWithConsequences(
    seasonId: number, 
    leagueId: number,
    applyConsequences: boolean = true,
    resetPromotionFlag: boolean = true // Nuevo parámetro
  ): Promise<{
    standings: Array<{ teamId: number; teamName: string; position: number; points: number; goalDifference: number; goalsFor: number; goalsAgainst: number; played: number; won: number; drawn: number; lost: number; followers: number; consequence?: 'PROMOTION' | 'RELEGATION' | 'PLAYOFF' | 'TOURNAMENT' | 'SAFE' }>;
    consequences: {
      directPromotions: number;
      directRelegations: number;
      playoffTeams: number;
      tournamentQualifiers: number;
      applied: boolean;
    };
  }> {
    const db = this.databaseService.db;
    
    // 1. Calcular clasificaciones usando la lógica unificada
    const standings = await this.calculateStandings(seasonId, leagueId);
    
    // 2. Obtener información de la división
    const [leagueInfo] = await db
      .select({
        divisionId: leagueTable.divisionId,
        divisionLevel: divisionTable.level,
        divisionName: divisionTable.name,
        promoteSlots: divisionTable.promoteSlots,
        promotePlayoffSlots: divisionTable.promotePlayoffSlots,
        relegateSlots: divisionTable.relegateSlots,
        tournamentSlots: divisionTable.tournamentSlots
      })
      .from(leagueTable)
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .where(eq(leagueTable.id, leagueId));
    
    if (!leagueInfo) {
      throw new Error(`No se encontró información de la liga ${leagueId}`);
    }
    
    // 3. Determinar consecuencias para cada equipo
    const standingsWithConsequences = standings.map(team => {
      let consequence: 'PROMOTION' | 'RELEGATION' | 'PLAYOFF' | 'TOURNAMENT' | 'SAFE' = 'SAFE';
      
      // Torneos (solo División 1)
      if (leagueInfo.divisionLevel === 1 && Number(leagueInfo.tournamentSlots || 0) > 0) {
        if (team.position <= Number(leagueInfo.tournamentSlots || 0)) {
          consequence = 'TOURNAMENT';
        }
      }
      
      // Ascensos directos (no División 1)
      if (leagueInfo.divisionLevel > 1 && Number(leagueInfo.promoteSlots || 0) > 0) {
        if (team.position <= Number(leagueInfo.promoteSlots || 0)) {
          consequence = 'PROMOTION';
        }
      }
      
      // Playoffs de ascenso (no División 1)
      if (leagueInfo.divisionLevel > 1 && Number(leagueInfo.promotePlayoffSlots || 0) > 0) {
        const startPos = Number(leagueInfo.promoteSlots || 0) + 1;
        const endPos = startPos + Number(leagueInfo.promotePlayoffSlots || 0) - 1;
        if (team.position >= startPos && team.position <= endPos) {
          consequence = 'PLAYOFF';
        }
      }
      
      // Descensos directos (no División 5 - ajustar según estructura real)
      if (leagueInfo.divisionLevel < 5 && Number(leagueInfo.relegateSlots || 0) > 0) {
        const relegationStartPos = standings.length - Number(leagueInfo.relegateSlots || 0) + 1;
        if (team.position >= relegationStartPos) {
          consequence = 'RELEGATION';
        }
      }
      
      return {
        ...team,
        consequence
      };
    });
    
    // 4. Aplicar marcas automáticamente si se solicita
    const consequences = {
      directPromotions: 0,
      directRelegations: 0,
      playoffTeams: 0,
      tournamentQualifiers: 0,
      applied: false
    };
    
    if (applyConsequences) {
      // Limpiar flags existentes para esta liga y temporada
      const resetFields: any = {
        relegatedNextSeason: false,
        playoffNextSeason: false,
        qualifiedForTournament: false,
        updatedAt: new Date()
      };
      if (resetPromotionFlag) {
        resetFields.promotedNextSeason = false;
      }
      await db
        .update(teamLeagueAssignmentTable)
        .set(resetFields)
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.leagueId, leagueId)
          )
        );
      
      // Aplicar nuevas marcas
      for (const team of standingsWithConsequences) {
        if (team.consequence !== 'SAFE') {
          const updateData: any = { updatedAt: new Date() };
          
          switch (team.consequence) {
            case 'PROMOTION':
              updateData.promotedNextSeason = true;
              consequences.directPromotions++;
              this.logger.log(`⬆️ ${team.teamName} marcado para ascenso directo (${team.position}º puesto)`);
              break;
            case 'RELEGATION':
              updateData.relegatedNextSeason = true;
              consequences.directRelegations++;
              this.logger.log(`⬇️ ${team.teamName} marcado para descenso directo (${team.position}º puesto)`);
              break;
            case 'PLAYOFF':
              updateData.playoffNextSeason = true;
              consequences.playoffTeams++;
              this.logger.log(`🎯 ${team.teamName} marcado para playoff de ascenso (${team.position}º puesto)`);
              break;
            case 'TOURNAMENT':
              updateData.qualifiedForTournament = true;
              consequences.tournamentQualifiers++;
              this.logger.log(`🏆 ${team.teamName} marcado para torneo (${team.position}º puesto)`);
              break;
          }
          
          await db
            .update(teamLeagueAssignmentTable)
            .set(updateData)
            .where(
              and(
                eq(teamLeagueAssignmentTable.teamId, team.teamId),
                eq(teamLeagueAssignmentTable.seasonId, seasonId),
                eq(teamLeagueAssignmentTable.leagueId, leagueId)
              )
            );
        }
      }
      
      consequences.applied = true;
      this.logger.log(`✅ Consecuencias aplicadas para liga ${leagueId} (División ${leagueInfo.divisionName})`);
    }
    
    return {
      standings: standingsWithConsequences,
      consequences
    };
  }
}
