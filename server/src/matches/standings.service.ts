import { Injectable, Inject, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { 
  standingsTable, 
  matchTable, 
  teamTable,
  leagueTable,
  seasonTable,
  teamLeagueAssignmentTable,
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
    
    // Usar la función unificada de cálculo de clasificaciones
    const sortedTeamStats = await this.calculateStandings(seasonId, leagueId);

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
   * @deprecated Usar calculateStandings() en su lugar
   * Aplicar reglas de desempate según el orden establecido:
   * 1. Puntos en enfrentamientos directos
   * 2. Diferencia de goles en enfrentamientos directos
   * 3. Diferencia de goles general
   * 4. Goles marcados en la liga
   * 5. Número de seguidores
   */
  private async applyTiebreakingRules(seasonId: number, leagueId: number, teamStats: TeamStats[]): Promise<TeamStats[]> {
    // Crear grupos de equipos empatados por puntos
    const pointGroups = this.groupTeamsByPoints(teamStats);
    
    const sortedTeams: TeamStats[] = [];
    
    for (const group of pointGroups) {
      if (group.length === 1) {
        // Sin empate, agregar directamente
        sortedTeams.push(...group);
      } else {
        // Resolver empate usando las reglas de desempate
        const resolvedGroup = await this.resolveTiedTeams(seasonId, leagueId, group);
        sortedTeams.push(...resolvedGroup);
      }
    }
    
    return sortedTeams;
  }

  /**
   * Agrupar equipos por puntos (orden descendente)
   */
  private groupTeamsByPoints(teams: TeamStats[]): TeamStats[][] {
    // Ordenar por puntos descendentemente
    teams.sort((a, b) => b.points - a.points);
    
    const groups: TeamStats[][] = [];
    let currentGroup: TeamStats[] = [];
    let currentPoints = -1;
    
    for (const team of teams) {
      if (team.points !== currentPoints) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [team];
        currentPoints = team.points;
      } else {
        currentGroup.push(team);
      }
    }
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }

  /**
   * Resolver empate entre equipos usando las reglas de desempate
   */
  private async resolveTiedTeams(seasonId: number, leagueId: number, tiedTeams: TeamStats[]): Promise<TeamStats[]> {
    if (tiedTeams.length <= 1) {
      return tiedTeams;
    }

    this.logger.log(`🔍 Resolviendo empate entre ${tiedTeams.length} equipos: ${tiedTeams.map(t => `Team ${t.teamId} (${t.points} pts, DG: ${t.goalDifference})`).join(', ')}`);

    // 1. Diferencia de goles
    let sortedTeams = [...tiedTeams].sort((a, b) => b.goalDifference - a.goalDifference);

    // 2. Goles a favor
    let firstGroup = this.groupBy(sortedTeams, t => t.goalDifference);
    sortedTeams = [];
    for (const group of firstGroup) {
      if (group.length === 1) {
        sortedTeams.push(...group);
      } else {
        // Empate en DG, ordenar por GF
        const gfSorted = [...group].sort((a, b) => b.goalsFor - a.goalsFor);
        sortedTeams.push(...gfSorted);
      }
    }

    // 3. Enfrentamientos directos
    let secondGroup = this.groupBy(sortedTeams, t => [t.goalDifference, t.goalsFor].join('-'));
    let afterDirect: TeamStats[] = [];
    for (const group of secondGroup) {
      if (group.length === 1) {
        afterDirect.push(...group);
      } else {
        // Empate en DG y GF, aplicar enfrentamientos directos
        const teamIds = group.map(t => t.teamId);
        const directResults = await this.calculateDirectMatches(seasonId, leagueId, teamIds);
        const directSorted = [...group].sort((a, b) => {
          const aRes = directResults.get(a.teamId)!;
          const bRes = directResults.get(b.teamId)!;
          // 1. Puntos en enfrentamientos directos
          if (aRes.points !== bRes.points) return bRes.points - aRes.points;
          // 2. Diferencia de goles en enfrentamientos directos
          if (aRes.goalDifference !== bRes.goalDifference) return bRes.goalDifference - aRes.goalDifference;
          // 3. Goles a favor en enfrentamientos directos
          if (aRes.goalsFor !== bRes.goalsFor) return bRes.goalsFor - aRes.goalsFor;
          return 0;
        });
        afterDirect.push(...directSorted);
      }
    }

    // 4. Número de seguidores
    let thirdGroup = this.groupBy(afterDirect, t => [t.goalDifference, t.goalsFor, t.teamId].join('-'));
    let afterFollowers: TeamStats[] = [];
    for (const group of thirdGroup) {
      if (group.length === 1) {
        afterFollowers.push(...group);
      } else {
        // Empate en todo lo anterior, ordenar por seguidores
        const followersSorted = [...group].sort((a, b) => b.followers - a.followers);
        afterFollowers.push(...followersSorted);
      }
    }

    // 5. Aleatorio si persiste el empate
    let finalGroup = this.groupBy(afterFollowers, t => [t.goalDifference, t.goalsFor, t.teamId, t.followers].join('-'));
    let finalSorted: TeamStats[] = [];
    for (const group of finalGroup) {
      if (group.length === 1) {
        finalSorted.push(...group);
      } else {
        // Empate total, ordenar aleatoriamente
        const shuffled = [...group].sort(() => Math.random() - 0.5);
        finalSorted.push(...shuffled);
      }
    }

    this.logger.log(`   ✅ Orden final: ${finalSorted.map(t => `Team ${t.teamId} (DG: ${t.goalDifference}, GF: ${t.goalsFor}, Followers: ${t.followers})`).join(', ')}`);
    return finalSorted;
  }

  // Agrupar por función
  private groupBy<T>(arr: T[], keyFn: (item: T) => any): T[][] {
    const map: Map<string, T[]> = new Map();
    for (const item of arr) {
      const key = JSON.stringify(keyFn(item));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.values());
  }

  /**
   * Calcular resultados de enfrentamientos directos entre equipos
   */
  private async calculateDirectMatches(seasonId: number, leagueId: number, teamIds: number[]): Promise<Map<number, DirectMatchResult>> {
    const db = this.databaseService.db;
    const results = new Map<number, DirectMatchResult>();
    
    // Inicializar resultados para cada equipo
    teamIds.forEach(teamId => {
      results.set(teamId, {
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0
      });
    });
    
    // Obtener todos los partidos entre estos equipos
    const directMatches = await db
      .select({
        homeTeamId: matchTable.homeTeamId,
        awayTeamId: matchTable.awayTeamId,
        homeGoals: matchTable.homeGoals,
        awayGoals: matchTable.awayGoals,
        status: matchTable.status
      })
      .from(matchTable)
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          eq(matchTable.leagueId, leagueId),
          eq(matchTable.status, MatchStatus.FINISHED),
          inArray(matchTable.homeTeamId, teamIds),
          inArray(matchTable.awayTeamId, teamIds)
        )
      );
    
    // Procesar cada partido
    for (const match of directMatches) {
      if (match.homeGoals !== null && match.awayGoals !== null) {
        const homeResult = results.get(match.homeTeamId)!;
        const awayResult = results.get(match.awayTeamId)!;
        
        // Actualizar goles
        homeResult.goalsFor += match.homeGoals;
        homeResult.goalsAgainst += match.awayGoals;
        awayResult.goalsFor += match.awayGoals;
        awayResult.goalsAgainst += match.homeGoals;
        
        // Actualizar puntos
        if (match.homeGoals > match.awayGoals) {
          homeResult.points += 3;
        } else if (match.homeGoals === match.awayGoals) {
          homeResult.points += 1;
          awayResult.points += 1;
        } else {
          awayResult.points += 3;
        }
      }
    }
    
    // Calcular diferencias de goles
    results.forEach(result => {
      result.goalDifference = result.goalsFor - result.goalsAgainst;
    });
    
    return results;
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
}
