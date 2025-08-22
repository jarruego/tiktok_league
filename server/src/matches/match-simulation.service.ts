
import { Injectable, NotFoundException, Inject, Logger, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { StandingsService } from '../standings/standings.service';
import { SeasonTransitionService } from '../teams/season-transition.service';
import { 
  matchTable, 
  teamTable,
  leagueTable,
  divisionTable,
  teamLeagueAssignmentTable,
  MatchStatus,
  lineupTable,
  matchPlayerStatsTable,
  playerTable
} from '../database/schema';
import { eq, and, sql, inArray, gte, lte } from 'drizzle-orm';
import { DATABASE_PROVIDER } from '../database/database.module';

// Mapeo de posiciones reales a categorías para simulación
const POSITIONS = {
  GK: ['Goalkeeper'],
  DEF: ['Centre-Back', 'Right-Back', 'Left-Back', 'Defence'],
  MED: [
    'Central Midfield',
    'Defensive Midfield',
    'Attacking Midfield',
    'Midfield',
  ],
  DEL: ['Centre-Forward', 'Right Winger', 'Left Winger']
};

function getPositionCategory(position: string): 'GK' | 'DEF' | 'MED' | 'DEL' {
  if (POSITIONS.GK.includes(position)) return 'GK';
  if (POSITIONS.DEF.includes(position)) return 'DEF';
  if (POSITIONS.MED.includes(position)) return 'MED';
  if (POSITIONS.DEL.includes(position)) return 'DEL';
  return 'DEF'; // Por defecto, si no se reconoce, lo tratamos como defensa
}

interface TeamWithFollowers {
  id: number;
  name: string;
  followers: number;
  isBot: boolean;
}

export interface MatchSimulationResult {
  matchId: number;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number;
  awayGoals: number;
  algorithmDetails: {
    homeTeamFollowers: number;
    awayTeamFollowers: number;
    followersDifference: number;
    randomEvents: number;
    followerBasedEvents: number;
  };
}

@Injectable()
export class MatchSimulationService {
  private readonly logger = new Logger(MatchSimulationService.name);

  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
    private readonly standingsService: StandingsService,
    @Inject(forwardRef(() => SeasonTransitionService))
    private readonly seasonTransitionService: SeasonTransitionService,
  ) {}

  /**
   * Job programado para simular partidos automáticamente cada día a las 16:50 (hora de Madrid)
   * Incluye recuperación automática de partidos pendientes de días anteriores
   */
  @Cron('50 16 * * *', {
    name: 'daily-match-simulation',
    timeZone: 'Europe/Madrid',
  })
  async simulateTodaysMatches() {
    // Log eliminado: progreso
    
    try {
      // Buscar partidos pendientes hasta 7 días atrás (por si el servidor estuvo caído)
      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const results = await this.simulatePendingMatchesInRange(sevenDaysAgo, today);
      
      // Logs eliminados: progreso
    } catch (error) {
      this.logger.error('❌ Error en la simulación automática:', error);
    }
  }

  /**
   * Simular todos los partidos de una fecha específica
   */
  async simulateMatchesByDate(date: string): Promise<MatchSimulationResult[]> {
    const results: MatchSimulationResult[] = [];
    const db = this.databaseService.db;
    
    // Extraer solo la fecha si viene con timestamp completo
    const dateOnly = date.includes('T') ? date.split('T')[0] : date;
    
    // Convertir la fecha string a Date para comparación
    const targetDate = new Date(dateOnly + 'T00:00:00.000Z');
    const nextDay = new Date(dateOnly + 'T23:59:59.999Z');
    
    // Obtener partidos programados para esta fecha
    const matches = await db
      .select({
        id: matchTable.id,
        homeTeamId: matchTable.homeTeamId,
        awayTeamId: matchTable.awayTeamId,
        scheduledDate: matchTable.scheduledDate,
        status: matchTable.status,
        seasonId: matchTable.seasonId
      })
      .from(matchTable)
      .where(
        and(
          gte(matchTable.scheduledDate, targetDate),
          lte(matchTable.scheduledDate, nextDay),
          eq(matchTable.status, MatchStatus.SCHEDULED)
        )
      );

    // Log eliminado: progreso

    for (const match of matches) {
      try {
        const result = await this.simulateSingleMatch(match.id);
        results.push(result);
      } catch (error) {
        this.logger.error(`❌ Error simulando partido ${match.id}:`, error);
      }
    }
    if (results.length > 0) {
      // Procesar consecuencias de la jornada sin logs de progreso
      const affectedMatchdays = new Map<number, Set<number>>(); // seasonId -> jornadas
      for (const match of matches) {
        if (!affectedMatchdays.has(match.seasonId)) {
          affectedMatchdays.set(match.seasonId, new Set());
        }
        // Obtener la jornada del partido
        const [matchInfo] = await this.databaseService.db
          .select({ matchday: matchTable.matchday })
          .from(matchTable)
          .where(eq(matchTable.id, match.id));
        if (matchInfo) {
          affectedMatchdays.get(match.seasonId)!.add(matchInfo.matchday);
        }
      }
      for (const [seasonId, matchdays] of affectedMatchdays) {
        for (const matchday of matchdays) {
          const isCompleted = await this.isMatchdayCompleted(seasonId, matchday);
          if (isCompleted) {
            await this.processMatchdayCompletion(seasonId, matchday);
          }
        }
      }
    }

    return results;
  }

  /**
   * Simular un partido específico por ID
   */
  async simulateSingleMatch(matchId: number): Promise<MatchSimulationResult> {
    const db = this.databaseService.db;
    
    // Obtener información del partido
    const [match] = await db
      .select()
      .from(matchTable)
      .where(eq(matchTable.id, matchId));

    if (!match) {
      throw new NotFoundException(`Partido con ID ${matchId} no encontrado`);
    }

    if (match.status !== MatchStatus.SCHEDULED) {
      throw new Error(`El partido ${matchId} no está programado (estado: ${match.status})`);
    }

    // Obtener información de los equipos
    const [homeTeam, awayTeam] = await Promise.all([
      db.select().from(teamTable).where(eq(teamTable.id, match.homeTeamId)).then(result => result[0]),
      db.select().from(teamTable).where(eq(teamTable.id, match.awayTeamId)).then(result => result[0])
    ]);


    if (!homeTeam || !awayTeam) {
      this.logger.error(`❌ Equipos no encontrados - Home: ${!!homeTeam}, Away: ${!!awayTeam}`);
      throw new NotFoundException('Uno o ambos equipos no encontrados');
    }


    // Calcular resultado usando el algoritmo especificado (considerando si es playoff)
    const simulationResult = this.calculateMatchResult(
      {
        id: homeTeam.id,
        name: homeTeam.name,
        followers: homeTeam.followers,
        isBot: !!homeTeam.isBot
      },
      {
        id: awayTeam.id,
        name: awayTeam.name,
        followers: awayTeam.followers,
        isBot: !!awayTeam.isBot
      },
      match.isPlayoff || false // Pasar información de si es playoff
    );

    // --- ASIGNACIÓN DE GOLES Y ASISTENCIAS SI HAY ALINEACIÓN ---
    // Helper para asignar goles/asistencias a un equipo
    async function asignarEstadisticasEquipo(teamId: number, goles: number, db: any, matchId: number) {
      // Buscar alineación
      const [alineacion] = await db.select().from(lineupTable).where(eq(lineupTable.teamId, teamId));
      if (!alineacion) {
        console.log(`[STATS] No se encontró alineación para el equipo ${teamId}`);
        return;
      }
      console.log(`[STATS] Alineación encontrada para el equipo ${teamId}:`, alineacion);

      // Convertir el objeto lineup a un array plano de jugadores con posición real
      let jugadores: Array<{ playerId: number, position: string }> = [];
      if (alineacion.lineup && typeof alineacion.lineup === 'object') {
        for (const [pos, arr] of Object.entries(alineacion.lineup)) {
          if (Array.isArray(arr)) {
            for (const pid of arr) {
              if (pid && !isNaN(Number(pid))) {
                // Buscar la posición real del jugador en la plantilla
                const [jugadorBD] = await db
                  .select({ position: playerTable.position })
                  .from(playerTable)
                  .where(eq(playerTable.id, Number(pid)));
                const realPosition = jugadorBD?.position || pos;
                jugadores.push({ playerId: Number(pid), position: realPosition });
              }
            }
          }
        }
      }
      if (jugadores.length === 0) {
        console.log(`[STATS] La alineación del equipo ${teamId} no contiene jugadores válidos. Valor:`, alineacion.lineup);
        return;
      }


      // Probabilidades por posición (ajustadas: GK nunca, DEF muy poco, MED poco, DEL mucho)
      const probGol = { 'GK': 0, 'DEF': 0.02, 'MED': 0.25, 'DEL': 0.73 };
      const probAsist = { 'GK': 0, 'DEF': 0.10, 'MED': 0.45, 'DEL': 0.45 };

      // Filtrar solo jugadores de campo (no porteros) usando el mapeo
      let jugadoresCampo = jugadores.filter(j => getPositionCategory(j.position) !== 'GK');
      if (jugadoresCampo.length < 10) {
        // Buscar plantilla de jugadores de campo
        const plantilla = await db
          .select({ id: 'id', position: 'position' })
          .from(playerTable)
          .where(and(eq(playerTable.teamId, teamId)));
        const plantillaCampo = plantilla.filter(j => getPositionCategory(j.position) !== 'GK');
        if (plantillaCampo.length >= 10) {
          // Elegir 10 al azar
          const shuffled = plantillaCampo.sort(() => Math.random() - 0.5);
          jugadoresCampo = shuffled.slice(0, 10).map(j => ({ playerId: j.id, position: j.position }));
        } else {
          // No hay suficientes jugadores de campo
          return;
        }
      }

      // Inicializar stats
      const stats: Record<number, { goals: number, assists: number, goalMinutes: number[] }> = {};
      jugadoresCampo.forEach(j => { stats[j.playerId] = { goals: 0, assists: 0, goalMinutes: [] }; });

      // Asignar goles y minutos
      const minutosDisponibles = Array.from({ length: 90 }, (_, i) => i + 1);
      for (let i = 0; i < goles; i++) {
        // Filtrar por probabilidad
        const candidatos = jugadoresCampo.filter(j => Math.random() < (probGol[getPositionCategory(j.position)] || 0.1));
        const elegibles = candidatos.length > 0 ? candidatos : jugadoresCampo;
        if (elegibles.length === 0) continue;
        const goleador = elegibles[Math.floor(Math.random() * elegibles.length)];
        stats[goleador.playerId].goals++;
        // Asignar minuto aleatorio no repetido
        const idx = Math.floor(Math.random() * minutosDisponibles.length);
        const minuto = minutosDisponibles.splice(idx, 1)[0];
        stats[goleador.playerId].goalMinutes.push(minuto);
      }

      // Asignar asistencias
      for (let i = 0; i < goles; i++) {
        // El goleador de este gol
        const posiblesGoleadores = jugadoresCampo.filter(j => stats[j.playerId].goals > 0);
        if (posiblesGoleadores.length === 0) break;
        const goleador = posiblesGoleadores[Math.floor(Math.random() * posiblesGoleadores.length)];
        stats[goleador.playerId].goals--;
        // Elegir asistente (no puede ser el mismo)
        const asistentes = jugadoresCampo.filter(j => j.playerId !== goleador.playerId && Math.random() < (probAsist[getPositionCategory(j.position)] || 0.1));
        const elegiblesAsist = asistentes.length > 0 ? asistentes : jugadoresCampo.filter(j => j.playerId !== goleador.playerId);
        if (elegiblesAsist.length > 0) {
          const asistente = elegiblesAsist[Math.floor(Math.random() * elegiblesAsist.length)];
          stats[asistente.playerId].assists++;
        }
        // Devolver el gol al goleador para el siguiente ciclo
        stats[goleador.playerId].goals++;
      }

      // Mostrar stats generados antes de guardar
      console.log(`[STATS] Stats generados para el equipo ${teamId} en el partido ${matchId}:`, stats);

      // Guardar en la base de datos
      for (const jugador of jugadores) {
        const { goals, assists, goalMinutes } = stats[jugador.playerId];
        if (goals > 0 || assists > 0) {
          try {
            await db.insert(matchPlayerStatsTable).values({
              matchId,
              playerId: jugador.playerId,
              teamId,
              goals,
              assists,
              goalMinutes
            });
            console.log(`[STATS] Guardado stats para jugador ${jugador.playerId} (equipo ${teamId}): goles=${goals}, asistencias=${assists}, minutos=${goalMinutes}`);
          } catch (err) {
            console.error(`[STATS] Error guardando stats para jugador ${jugador.playerId} (equipo ${teamId}):`, err);
      
            // Si no hay alineación válida, obtener 10 jugadores de campo al azar de la plantilla
            let jugadoresCampo = jugadores.filter(j => j.position !== 'GK' && j.position !== 'POR');
            if (jugadoresCampo.length < 10) {
              // Buscar plantilla de jugadores de campo
              const plantilla = await db
                .select({ id: 'id', position: 'position' })
                .from(playerTable)
                .where(and(eq(playerTable.teamId, teamId), sql`position NOT IN ('GK', 'POR')`));
              if (plantilla.length >= 10) {
                // Elegir 10 al azar
                const shuffled = plantilla.sort(() => Math.random() - 0.5);
                jugadoresCampo = shuffled.slice(0, 10).map(j => ({ playerId: j.id, position: j.position.toUpperCase() }));
              } else {
                // No hay suficientes jugadores de campo
                return;
              }
            }

          }
        }
      }
    }

            // const jugadoresCampo = jugadores.filter(j => j.position !== 'GK' && j.position !== 'POR');
    await asignarEstadisticasEquipo(homeTeam.id, simulationResult.homeGoals, db, matchId);
    await asignarEstadisticasEquipo(awayTeam.id, simulationResult.awayGoals, db, matchId);

    // Actualizar el partido en la base de datos
    await db
      .update(matchTable)
      .set({
        homeGoals: simulationResult.homeGoals,
        awayGoals: simulationResult.awayGoals,
        status: MatchStatus.FINISHED,
        simulationDetails: JSON.stringify(simulationResult.algorithmDetails),
        updatedAt: new Date()
      })
      .where(eq(matchTable.id, matchId));

    // Log eliminado: resultado partido

    // Si es un partido de playoff, actualizar estados de equipos
    if (match.isPlayoff) {
      await this.seasonTransitionService.updateTeamStatusAfterPlayoffMatch(matchId);
    }
    // NOTA: Las clasificaciones se recalculan al final de la jornada, no después de cada partido

    return {
      matchId,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      homeGoals: simulationResult.homeGoals,
      awayGoals: simulationResult.awayGoals,
      algorithmDetails: simulationResult.algorithmDetails
    };
  }

  /**
   * Algoritmo de simulación de partidos
   * 25% probabilidad aleatoria + 75% basada en diferencia de seguidores
   * Si es playoff, garantiza que no hay empates
   */
  private calculateMatchResult(
    homeTeam: TeamWithFollowers, 
    awayTeam: TeamWithFollowers, 
    isPlayoff: boolean = false
  ) {
    // Si uno es bot y el otro no, el humano gana 1-5 a 0
    if (homeTeam.isBot !== awayTeam.isBot) {
      const humanIsHome = !homeTeam.isBot;
      const goals = Math.floor(Math.random() * 5) + 1; // 1 a 5
      return {
        homeGoals: humanIsHome ? goals : 0,
        awayGoals: humanIsHome ? 0 : goals,
        algorithmDetails: {
          homeTeamFollowers: homeTeam.followers,
          awayTeamFollowers: awayTeam.followers,
          followersDifference: homeTeam.followers - awayTeam.followers,
          randomEvents: 0,
          followerBasedEvents: 0
        }
      };
    }

    // Algoritmo normal si ambos son bots o ambos humanos
    const followersDifference = homeTeam.followers - awayTeam.followers;
    const totalFollowers = homeTeam.followers + awayTeam.followers;
    const homeAdvantage = totalFollowers > 0 ? (homeTeam.followers / totalFollowers) : 0.5;
    const normalizedHomeAdvantage = 0.2 + (homeAdvantage * 0.6);
    let homeGoals = 0;
    let awayGoals = 0;
    let randomEvents = 0;
    let followerBasedEvents = 0;
    const totalEvents = Math.floor(Math.random() * 7); // 0-6 goles en total
    for (let i = 0; i < totalEvents; i++) {
      const random = Math.random();
      if (random < 0.25) {
        randomEvents++;
        if (Math.random() < 0.5) {
          homeGoals++;
        } else {
          awayGoals++;
        }
      } else {
        followerBasedEvents++;
        if (Math.random() < normalizedHomeAdvantage) {
          homeGoals++;
        } else {
          awayGoals++;
        }
      }
    }
    if (Math.random() < 0.15 && totalEvents > 0) {
      homeGoals++;
    }
    if (isPlayoff && homeGoals === awayGoals) {
      if (Math.random() < normalizedHomeAdvantage) {
        homeGoals++;
      } else {
        awayGoals++;
      }
    }
    return {
      homeGoals,
      awayGoals,
      algorithmDetails: {
        homeTeamFollowers: homeTeam.followers,
        awayTeamFollowers: awayTeam.followers,
        followersDifference,
        randomEvents,
        followerBasedEvents
      }
    };
  }

  /**
   * Simular todos los partidos pendientes (útil para pruebas)
   */
  async simulateAllPendingMatches(): Promise<MatchSimulationResult[]> {
    const db = this.databaseService.db;

    const pendingMatches = await db
      .select({ 
        id: matchTable.id,
        seasonId: matchTable.seasonId 
      })
      .from(matchTable)
      .where(eq(matchTable.status, MatchStatus.SCHEDULED));

    if (pendingMatches.length === 0) {
      return [];
    }

    const results: MatchSimulationResult[] = [];

    for (const match of pendingMatches) {
      try {
        const result = await this.simulateSingleMatch(match.id);
        results.push(result);
      } catch (error) {
        this.logger.error(`❌ Error simulando partido ${match.id}:`, error);
        this.logger.error(`❌ Error stack:`, error.stack);
      }
    }

    // Recalcular clasificaciones si se simularon partidos
    if (results.length > 0) {
      // Obtener temporadas afectadas
      const affectedSeasons = new Set(pendingMatches.map(m => m.seasonId));

      // Recalcular clasificaciones para cada temporada
      for (const seasonId of affectedSeasons) {
        await this.standingsService.recalculateStandingsForSeason(seasonId);
      }

      // Verificar y generar playoffs automáticamente para divisiones completadas
      for (const seasonId of affectedSeasons) {
        await this.checkAndGeneratePlayoffs(seasonId);
        // Crear finales automáticamente si las semifinales están completadas
        await this.seasonTransitionService.createPlayoffFinalsIfNeeded(seasonId);
        // Procesar ganadores de playoffs para marcarlos para ascenso
        await this.seasonTransitionService.processPlayoffWinnersForPromotion(seasonId);
        // Asignar ligas automáticamente para la próxima temporada
        await this.seasonTransitionService.assignLeaguesForNextSeason(seasonId);
      }
    }

    return results;
  }

  /**
   * Obtener estadísticas de simulación
   */
  async getSimulationStats() {
    const db = this.databaseService.db;
    
    const [stats] = await db
      .select({
        totalMatches: sql<number>`count(*)`,
        scheduledMatches: sql<number>`count(case when status = 'scheduled' then 1 end)`,
        finishedMatches: sql<number>`count(case when status = 'finished' then 1 end)`,
        averageGoalsPerMatch: sql<number>`avg(coalesce(home_goals, 0) + coalesce(away_goals, 0))`,
        homeWins: sql<number>`count(case when home_goals > away_goals then 1 end)`,
        awayWins: sql<number>`count(case when away_goals > home_goals then 1 end)`,
        draws: sql<number>`count(case when home_goals = away_goals then 1 end)`
      })
      .from(matchTable);

    return stats;
  }

  /**
   * Verifica si una división ha completado todos sus partidos regulares
   * y genera automáticamente los playoffs si es necesario
   */
  private async checkAndGeneratePlayoffs(seasonId: number): Promise<void> {
    try {
      // Obtener solo las divisiones que tienen equipos asignados en esta temporada
      const divisionsWithTeams = await this.databaseService.db
        .select({
          id: divisionTable.id,
          name: divisionTable.name,
          promotePlayoffSlots: divisionTable.promotePlayoffSlots
        })
        .from(divisionTable)
        .innerJoin(leagueTable, eq(divisionTable.id, leagueTable.divisionId))
        .innerJoin(teamLeagueAssignmentTable, eq(leagueTable.id, teamLeagueAssignmentTable.leagueId))
        .where(eq(teamLeagueAssignmentTable.seasonId, seasonId))
        .groupBy(divisionTable.id, divisionTable.name, divisionTable.promotePlayoffSlots);

      for (const division of divisionsWithTeams) {
        // Verificar si todos los partidos regulares de esta división están completados
        const isCompleted = await this.isDivisionCompleted(division.id, seasonId);
        
        if (isCompleted) {
          // NUEVO: Marcar equipos según posición final en liga regular
          await this.seasonTransitionService.markTeamsBasedOnRegularSeasonPosition(division.id, seasonId);
          
          // Verificar si ya existen partidos de playoff para esta división
          const existingPlayoffs = await this.hasExistingPlayoffs(division.id, seasonId);
          
          if (!existingPlayoffs && division.promotePlayoffSlots && division.promotePlayoffSlots > 0) {
            // Generar partidos de playoff
            const playoffMatches = await this.seasonTransitionService.organizePlayoffs(
              division.id, 
              seasonId
            );
            // No logs de progreso
          }
        }
      }
    } catch (error) {
      this.logger.error('❌ Error verificando/generando playoffs:', error);
    }
  }

  /**
   * Verifica si todos los partidos regulares de una división están completados
   */
  private async isDivisionCompleted(divisionId: number, seasonId: number): Promise<boolean> {
    // Obtener todas las ligas de la división
    const leagues = await this.databaseService.db
      .select({ id: leagueTable.id })
      .from(leagueTable)
      .where(eq(leagueTable.divisionId, divisionId));

    if (leagues.length === 0) return false;

    const leagueIds = leagues.map(l => l.id);

    // Contar partidos pendientes (no playoff) en todas las ligas de la división
    const [pendingCount] = await this.databaseService.db
      .select({ count: sql<number>`count(*)` })
      .from(matchTable)
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          inArray(matchTable.leagueId, leagueIds),
          eq(matchTable.status, MatchStatus.SCHEDULED),
          sql`${matchTable.isPlayoff} IS NOT TRUE` // Solo partidos regulares
        )
      );

    return Number(pendingCount.count) === 0;
  }

  /**
   * Verifica si ya existen partidos de playoff para una división
   */
  private async hasExistingPlayoffs(divisionId: number, seasonId: number): Promise<boolean> {
    // Obtener todas las ligas de la división
    const leagues = await this.databaseService.db
      .select({ id: leagueTable.id })
      .from(leagueTable)
      .where(eq(leagueTable.divisionId, divisionId));

    if (leagues.length === 0) return false;

    const leagueIds = leagues.map(l => l.id);

    // Verificar si existen partidos de playoff
    const [playoffCount] = await this.databaseService.db
      .select({ count: sql<number>`count(*)` })
      .from(matchTable)
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          inArray(matchTable.leagueId, leagueIds),
          eq(matchTable.isPlayoff, true)
        )
      );

    return Number(playoffCount.count) > 0;
  }

  /**
   * Verifica si se completó la liga regular de una división y marca automáticamente a los equipos
   */
  private async checkAndMarkTeamsIfRegularSeasonComplete(leagueId: number, seasonId: number): Promise<void> {
    const db = this.databaseService.db;
    
    try {
      // Obtener información de la liga y división
      const [leagueInfo] = await db
        .select({
          leagueId: leagueTable.id,
          divisionId: leagueTable.divisionId,
          divisionName: divisionTable.name,
          divisionLevel: divisionTable.level
        })
        .from(leagueTable)
        .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
        .where(eq(leagueTable.id, leagueId));

      if (!leagueInfo) return;

      // Verificar si la división ha completado todos sus partidos regulares
      const isComplete = await this.seasonTransitionService.isDivisionRegularSeasonComplete(
        leagueInfo.divisionId, 
        seasonId
      );

      if (isComplete) {
        // Verificar si ya se marcaron los equipos para esta división
        const [existingMarks] = await db
          .select({ count: sql<number>`count(*)` })
          .from(teamLeagueAssignmentTable)
          .innerJoin(leagueTable, eq(teamLeagueAssignmentTable.leagueId, leagueTable.id))
          .where(
            and(
              eq(teamLeagueAssignmentTable.seasonId, seasonId),
              eq(leagueTable.divisionId, leagueInfo.divisionId),
              sql`(
                ${teamLeagueAssignmentTable.promotedNextSeason} = true OR 
                ${teamLeagueAssignmentTable.relegatedNextSeason} = true OR 
                ${teamLeagueAssignmentTable.playoffNextSeason} = true OR 
                ${teamLeagueAssignmentTable.qualifiedForTournament} = true
              )`
            )
          );

        if (Number(existingMarks.count) === 0) {
          // Marcar equipos según posición final
          await this.seasonTransitionService.markTeamsBasedOnRegularSeasonPosition(
            leagueInfo.divisionId,
            seasonId
          );
        }
      }
    } catch (error) {
      this.logger.error('Error verificando finalización de liga regular:', error);
    }
  }

  /**
   * Verificar si una jornada específica está completamente terminada
   * (todos los partidos de esa jornada simulados)
   */
  private async isMatchdayCompleted(seasonId: number, matchday: number): Promise<boolean> {
    const [pendingCount] = await this.databaseService.db
      .select({ count: sql<number>`count(*)` })
      .from(matchTable)
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          eq(matchTable.matchday, matchday),
          eq(matchTable.status, MatchStatus.SCHEDULED),
          sql`${matchTable.isPlayoff} IS NOT TRUE` // Solo partidos regulares
        )
      );

    return Number(pendingCount.count) === 0;
  }

  /**
   * Procesar consecuencias al finalizar una jornada completa
   */
  private async processMatchdayCompletion(seasonId: number, matchday: number): Promise<void> {
    // Recalcular clasificaciones
    await this.standingsService.recalculateStandingsForSeason(seasonId);

    // Verificar divisiones completadas y generar playoffs (sin logs de progreso)
    await this.checkAndGeneratePlayoffs(seasonId);

    // Verificar finales automáticas (sin logs de progreso)
    await this.seasonTransitionService.createPlayoffFinalsIfNeeded(seasonId);

    // Procesar ganadores de playoffs para ascenso (sin logs de progreso)
    await this.seasonTransitionService.processPlayoffWinnersForPromotion(seasonId);

    // Asignar ligas automáticamente para la próxima temporada (sin logs de progreso)
    await this.seasonTransitionService.assignLeaguesForNextSeason(seasonId);
  }

  /**
   * Simular todos los partidos pendientes en un rango de fechas (para recuperación automática)
   */
  async simulatePendingMatchesInRange(startDate: Date, endDate: Date): Promise<MatchSimulationResult[]> {
    const db = this.databaseService.db;
    
    // Obtener partidos pendientes en el rango de fechas
    const pendingMatches = await db
      .select({
        id: matchTable.id,
        homeTeamId: matchTable.homeTeamId,
        awayTeamId: matchTable.awayTeamId,
        scheduledDate: matchTable.scheduledDate,
        status: matchTable.status,
        seasonId: matchTable.seasonId
      })
      .from(matchTable)
      .where(
        and(
          gte(matchTable.scheduledDate, startDate),
          lte(matchTable.scheduledDate, endDate),
          eq(matchTable.status, MatchStatus.SCHEDULED)
        )
      )
      .orderBy(matchTable.scheduledDate);

    if (pendingMatches.length === 0) {
      return [];
    }

    this.logger.log(`🔍 Encontrados ${pendingMatches.length} partidos pendientes en el rango de fechas`);
    
    const results: MatchSimulationResult[] = [];
    
    // Agrupar partidos por fecha para procesarlos por jornadas
    const matchesByDate = new Map<string, typeof pendingMatches>();
    
    for (const match of pendingMatches) {
      const dateKey = match.scheduledDate.toISOString().split('T')[0];
      if (!matchesByDate.has(dateKey)) {
        matchesByDate.set(dateKey, []);
      }
      matchesByDate.get(dateKey)!.push(match);
    }

    // Procesar cada fecha por separado para mantener la lógica de jornadas
    for (const [dateKey, matches] of matchesByDate) {
      this.logger.log(`📅 Simulando ${matches.length} partidos para ${dateKey}`);
      
      for (const match of matches) {
        try {
          const result = await this.simulateSingleMatch(match.id);
          results.push(result);
        } catch (error) {
          this.logger.error(`❌ Error simulando partido ${match.id}:`, error);
        }
      }

      // Procesar consecuencias de la jornada si hay resultados
      if (matches.length > 0) {
        // Obtener jornadas y temporadas afectadas para esta fecha
        const affectedMatchdays = new Map<number, Set<number>>(); // seasonId -> jornadas
        
        for (const match of matches) {
          if (!affectedMatchdays.has(match.seasonId)) {
            affectedMatchdays.set(match.seasonId, new Set());
          }
          
          // Obtener la jornada del partido
          const [matchInfo] = await this.databaseService.db
            .select({ matchday: matchTable.matchday })
            .from(matchTable)
            .where(eq(matchTable.id, match.id));
            
          if (matchInfo) {
            affectedMatchdays.get(match.seasonId)!.add(matchInfo.matchday);
          }
        }

        // Procesar cada jornada completada
        for (const [seasonId, matchdays] of affectedMatchdays) {
          for (const matchday of matchdays) {
            const isCompleted = await this.isMatchdayCompleted(seasonId, matchday);
            if (isCompleted) {
              await this.processMatchdayCompletion(seasonId, matchday);
            }
          }
        }
      }
    }

    return results;
  }
}
