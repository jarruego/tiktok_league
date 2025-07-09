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

    // Aplicar nueva lógica de desempate
    const sortedTeamStats = await this.applyTiebreakingRules(seasonId, leagueId, teamStats);

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
      const standingsData = sortedTeamStats.map((stats, index) => ({
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

    // Obtener clasificaciones sin ordenar por posición (aplicaremos lógica de desempate)
    const rawStandings = await db
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
        teamCrest: teamTable.crest,
        followers: teamTable.followers,
        // Campos de estado del equipo
        promotedNextSeason: teamLeagueAssignmentTable.promotedNextSeason,
        relegatedNextSeason: teamLeagueAssignmentTable.relegatedNextSeason,
        playoffNextSeason: teamLeagueAssignmentTable.playoffNextSeason,
        qualifiedForTournament: teamLeagueAssignmentTable.qualifiedForTournament
      })
      .from(standingsTable)
      .innerJoin(teamTable, eq(standingsTable.teamId, teamTable.id))
      .leftJoin(
        teamLeagueAssignmentTable,
        and(
          eq(teamLeagueAssignmentTable.teamId, teamTable.id),
          eq(teamLeagueAssignmentTable.seasonId, seasonId),
          eq(teamLeagueAssignmentTable.leagueId, leagueId)
        )
      )
      .where(
        and(
          eq(standingsTable.seasonId, seasonId),
          eq(standingsTable.leagueId, leagueId)
        )
      );

    // Aplicar lógica de desempate en tiempo real
    const teamStats: TeamStats[] = rawStandings.map(s => ({
      teamId: s.teamId,
      played: s.played,
      won: s.won,
      drawn: s.drawn,
      lost: s.lost,
      goalsFor: s.goalsFor,
      goalsAgainst: s.goalsAgainst,
      goalDifference: s.goalDifference,
      points: s.points,
      followers: s.followers || 0
    }));

    const sortedTeamStats = await this.applyTiebreakingRules(seasonId, leagueId, teamStats);
    
    this.logger.log(`📊 Aplicando nueva lógica de desempate para ${teamStats.length} equipos`);

    // Mapear a StandingData con posiciones dinámicas
    const standings = sortedTeamStats.map((stats, index) => {
      const rawData = rawStandings.find(r => r.teamId === stats.teamId)!;
      
      // Determinar el estado del equipo
      const status = this.determineTeamStatus(
        rawData.promotedNextSeason || false,
        rawData.relegatedNextSeason || false,
        rawData.playoffNextSeason || false,
        rawData.qualifiedForTournament || false
      );
      
      return {
        position: index + 1, // Posición dinámica basada en la nueva lógica
        team: {
          id: rawData.teamId,
          name: rawData.teamName,
          shortName: rawData.teamShortName,
          crest: rawData.teamCrest
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
      lastUpdated: rawStandings.length > 0 ? rawStandings[0].updatedAt.toISOString() : new Date().toISOString()
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
    
    // Aplicar criterios de desempate directamente, sin enfrentamientos directos por ahora
    const sortedTeams = [...tiedTeams].sort((a, b) => {
      const teamAId = a.teamId;
      const teamBId = b.teamId;
      
      // 3. Diferencia de goles general (criterio principal por ahora)
      if (a.goalDifference !== b.goalDifference) {
        this.logger.log(`   └─ Team ${teamAId} vs Team ${teamBId}: General GD ${a.goalDifference} vs ${b.goalDifference}`);
        return b.goalDifference - a.goalDifference;
      }
      
      // 4. Goles marcados en la liga
      if (a.goalsFor !== b.goalsFor) {
        this.logger.log(`   └─ Team ${teamAId} vs Team ${teamBId}: Goals for ${a.goalsFor} vs ${b.goalsFor}`);
        return b.goalsFor - a.goalsFor;
      }
      
      // 5. Número de seguidores
      if (a.followers !== b.followers) {
        this.logger.log(`   └─ Team ${teamAId} vs Team ${teamBId}: Followers ${a.followers} vs ${b.followers}`);
        return b.followers - a.followers;
      }
      
      return 0;
    });
    
    this.logger.log(`   ✅ Orden final: ${sortedTeams.map(t => `Team ${t.teamId} (DG: ${t.goalDifference}, GF: ${t.goalsFor})`).join(', ')}`);
    
    return sortedTeams;
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
