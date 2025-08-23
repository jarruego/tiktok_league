

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
        // Detener la simulación si ocurre un error
        throw error;
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
  // ...
      // Buscar alineación (usar SQL crudo para evitar internals que provoquen recursión)
      let alineacion: any = undefined;
      try {
        const rawLineup = await db.execute(`SELECT id, team_id, lineup FROM lineups WHERE team_id = ${teamId} LIMIT 1`);
        alineacion = rawLineup.rows ? rawLineup.rows[0] : (Array.isArray(rawLineup) ? rawLineup[0] : undefined);
      } catch (err) {
        // si falla, alineacion quedará undefined y el flujo continuará
        alineacion = undefined;
      }
      let jugadores: Array<{ playerId: number, position: string }> = [];
      if (alineacion && alineacion.lineup && typeof alineacion.lineup === 'object') {
        for (const [pos, arr] of Object.entries(alineacion.lineup)) {
          if (Array.isArray(arr)) {
            for (const pid of arr) {
              if (pid && !isNaN(Number(pid))) {
                // Buscar la posición real del jugador en la plantilla (SQL crudo)
                let realPosition = pos;
                try {
                  const rawJugador = await db.execute(`SELECT position FROM players WHERE id = ${Number(pid)} LIMIT 1`);
                  const jugadorRow = rawJugador.rows ? rawJugador.rows[0] : (Array.isArray(rawJugador) ? rawJugador[0] : undefined);
                  if (jugadorRow && jugadorRow.position) realPosition = jugadorRow.position;
                } catch (err) {
                  // mantener pos si la consulta falla
                }
                jugadores.push({ playerId: Number(pid), position: realPosition });
              }
            }
          }
        }
      }
  // ...
      // Si no hay alineación válida o no hay jugadores válidos, generar 11 jugadores de la plantilla
      if (jugadores.length === 0) {
        // ...
        // Buscar plantilla completa (incluyendo portero) con manejo de errores
        let plantilla: Array<{id: number, position: string}> = [];
        try {
          // Solo raw SQL para evitar bug de Drizzle
          const rawResult = await db.execute(
            `SELECT id, position FROM players WHERE team_id = ${teamId}`
          );
          plantilla = rawResult.rows || rawResult;
          if (!Array.isArray(plantilla)) plantilla = [];
        } catch (rawErr) {
          // Intentar fallback con Drizzle si el SQL crudo falla
          try {
            const drRes = await db.select({ id: playerTable.id, position: playerTable.position }).from(playerTable).where(eq(playerTable.teamId, teamId));
            plantilla = Array.isArray(drRes) ? drRes.map(r => ({ id: r.id, position: (r as any).position })) : [];
          } catch (drErr) {
            // Log removed: detailed stats fetch errors suppressed per request
            return false;
          }
        }
        if (!Array.isArray(plantilla) || plantilla.length === 0) {
          return false;
        }
        if (plantilla.length >= 11) {
          // Elegir 11 al azar
          const shuffled = plantilla.sort(() => Math.random() - 0.5);
          jugadores = shuffled.slice(0, 11).map(j => ({ playerId: j.id, position: j.position }));
        } else {
          // ...
          // Plantilla insuficiente para elegir 11 jugadores
          return false;
        }
      }

      // Probabilidades por posición (ajustadas: GK nunca, DEF muy poco, MED poco, DEL mucho)
      const probGol = { 'GK': 0, 'DEF': 0.02, 'MED': 0.25, 'DEL': 0.73 };
      const probAsist = { 'GK': 0, 'DEF': 0.10, 'MED': 0.45, 'DEL': 0.45 };

      // Filtrar solo jugadores de campo (no porteros) usando el mapeo
      let jugadoresCampo = jugadores.filter(j => getPositionCategory(j.position) !== 'GK');
      if (jugadoresCampo.length < 10) {
        // Buscar plantilla de jugadores de campo
        // Obtener plantilla de jugadores de campo usando SQL crudo para evitar recorrer internals
        let plantilla: Array<{ id: number, position: string }> = [];
        try {
          const rawPlant = await db.execute(`SELECT id, position FROM players WHERE team_id = ${teamId}`);
          plantilla = rawPlant.rows ? rawPlant.rows : (Array.isArray(rawPlant) ? rawPlant : []);
        } catch (err) {
          // Intentar fallback con Drizzle si db.execute falla
          try {
            const drRes = await db.select({ id: playerTable.id, position: playerTable.position }).from(playerTable).where(eq(playerTable.teamId, teamId));
            plantilla = Array.isArray(drRes) ? drRes.map(r => ({ id: r.id, position: (r as any).position })) : [];
          } catch (drErr) {
            // Log removed: detailed stats fetch errors suppressed per request
            plantilla = [];
          }
        }
        const plantillaCampo = plantilla.filter(j => getPositionCategory(j.position) !== 'GK');
        if (plantillaCampo.length >= 10) {
          // Elegir 10 al azar
          const shuffled = plantillaCampo.sort(() => Math.random() - 0.5);
          jugadoresCampo = shuffled.slice(0, 10).map(j => ({ playerId: j.id, position: j.position }));
        } else {
          // No hay suficientes jugadores de campo
          return false;
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

      // --- Asegurar que la suma de goles asignados coincide con el resultado solicitado ---
      const totalAssignedGoals = Object.values(stats).reduce((s, v) => s + (v.goals || 0), 0);
      if (totalAssignedGoals < goles) {
        // Asignar goles faltantes aleatoriamente entre jugadores de campo
        let faltan = goles - totalAssignedGoals;
        while (faltan > 0) {
          const candidato = jugadoresCampo[Math.floor(Math.random() * jugadoresCampo.length)];
          if (!candidato) break;
          stats[candidato.playerId].goals++;
          // asignar minuto si quedan disponibles
          const idx = minutosDisponibles.length > 0 ? Math.floor(Math.random() * minutosDisponibles.length) : -1;
          const minuto = idx >= 0 ? minutosDisponibles.splice(idx, 1)[0] : 90;
          stats[candidato.playerId].goalMinutes.push(minuto);
          faltan--;
        }
      } else if (totalAssignedGoals > goles) {
        // Reducir goles sobrantes quitándolos a jugadores al azar
        let sobrantes = totalAssignedGoals - goles;
        const playersWithGoals = Object.keys(stats).filter(pid => stats[Number(pid)].goals > 0).map(n => Number(n));
        while (sobrantes > 0 && playersWithGoals.length > 0) {
          const idx = Math.floor(Math.random() * playersWithGoals.length);
          const pid = playersWithGoals[idx];
          if (stats[pid].goals > 0) {
            stats[pid].goals--;
            // también eliminar un minuto si existe
            if (stats[pid].goalMinutes.length > 0) stats[pid].goalMinutes.pop();
            sobrantes--;
            if (stats[pid].goals === 0) playersWithGoals.splice(idx, 1);
          } else {
            playersWithGoals.splice(idx, 1);
          }
        }
      }

  // ...

      // Chequeo final: si jugadores está vacío, abortar
      if (!Array.isArray(jugadores) || jugadores.length === 0) {
        // Log removed: no players aligned or in squad — suppressing message as requested
        return false; // Indica que no se guardaron stats
      }

      // Antes de guardar: eliminar stats previos para este partido y equipo (sobrescribir)
      try {
        await db.execute(`DELETE FROM match_player_stats WHERE match_id = ${matchId} AND team_id = ${teamId}`);
      } catch (delErr) {
        // Log removed: suppressing detailed delete error for match_player_stats per request
        // no abortamos por esto; continuamos intentando insertar
      }

      // Guardar en la base de datos: iterar sobre la unión única de jugadores originales y los jugadores de campo
      // Esto garantiza que si reemplazamos jugadoresCampo (por falta de alineación) las estadísticas asignadas
      // a esos jugadores se persistan correctamente.
      const playersMap = new Map<number, { playerId: number, position: string }>();
      // añadir jugadores (p. ej. alineación original, contiene GK)
      if (Array.isArray(jugadores)) {
        for (const j of jugadores) playersMap.set(Number(j.playerId), { playerId: Number(j.playerId), position: j.position });
      }
      // añadir jugadoresCampo (quienes realmente recibieron goles/asistencias)
      if (Array.isArray(jugadoresCampo)) {
        for (const jc of jugadoresCampo) playersMap.set(Number(jc.playerId), { playerId: Number(jc.playerId), position: jc.position });
      }

      for (const jugadorInfo of playersMap.values()) {
        const pid = Number(jugadorInfo.playerId);
        const { goals = 0, assists = 0, goalMinutes = [] } = (stats[pid] || {});
        // Normalización de tipos para evitar errores de serialización
        const safeGoals = Number.isFinite(goals) ? goals : 0;
        const safeAssists = Number.isFinite(assists) ? assists : 0;
        const safeMinutesPlayed = 90;
        // goalMinutes debe ser un array plano de números
        let safeGoalMinutes: number[] = [];
        if (Array.isArray(goalMinutes)) {
          safeGoalMinutes = (goalMinutes as unknown as number[]).flat().filter((m: any) => Number.isFinite(m));
        }

        try {
          // Construir un objeto sanitizado con tipos primitivos
          const safeGoalMinutesNumeric = Array.isArray(safeGoalMinutes)
            ? safeGoalMinutes.map((m: any) => Number(m)).filter((n: number) => Number.isFinite(n))
            : [];

          const sanitizedInsertObj = {
            matchId: Number(matchId),
            playerId: pid,
            teamId: Number(teamId),
            goals: Number.isFinite(safeGoals) ? Number(safeGoals) : 0,
            assists: Number.isFinite(safeAssists) ? Number(safeAssists) : 0,
            goalMinutes: safeGoalMinutesNumeric,
            minutesPlayed: Number.isFinite(safeMinutesPlayed) ? Number(safeMinutesPlayed) : 0
          };

          // Intento de serializar solo con fines de depuración; si falla, lo ignoramos
          try { JSON.stringify(sanitizedInsertObj); } catch (e) { /* noop */ }

          // Usar SQL crudo para evitar que internals de Drizzle (orderSelectedFields)
          // intenten recorrer estructuras que pudieran provocar recursión.
          // Escapamos el JSON de goalMinutes de forma segura.
          const goalMinutesJson = JSON.stringify(sanitizedInsertObj.goalMinutes || []).replace(/'/g, "''");
          const insertSql = `INSERT INTO match_player_stats (match_id, player_id, team_id, goals, assists, goal_minutes, minutes_played) VALUES (${sanitizedInsertObj.matchId}, ${sanitizedInsertObj.playerId}, ${sanitizedInsertObj.teamId}, ${sanitizedInsertObj.goals}, ${sanitizedInsertObj.assists}, '${goalMinutesJson}', ${sanitizedInsertObj.minutesPlayed})`;
          await db.execute(insertSql);
        } catch (err) {
          // Log removed: suppressing per-player insert error details per request
        }
      }
  // Indicar éxito
  return true;
    }

            // const jugadoresCampo = jugadores.filter(j => j.position !== 'GK' && j.position !== 'POR');

    const homeStatsGuardadas = await asignarEstadisticasEquipo(homeTeam.id, simulationResult.homeGoals, db, matchId);
    const awayStatsGuardadas = await asignarEstadisticasEquipo(awayTeam.id, simulationResult.awayGoals, db, matchId);
  // Si no se guardaron stats individuales, se continúa sin log adicional

    // Actualizar el partido en la base de datos
    try {
      let safeAlgorithmDetails;
      try {
        safeAlgorithmDetails = JSON.stringify(simulationResult.algorithmDetails);
      } catch (e) {
        safeAlgorithmDetails = '[NO SERIALIZABLE]';
      }
      await db
        .update(matchTable)
        .set({
          homeGoals: simulationResult.homeGoals,
          awayGoals: simulationResult.awayGoals,
          status: MatchStatus.FINISHED,
          simulationDetails: safeAlgorithmDetails,
          updatedAt: new Date()
        })
        .where(eq(matchTable.id, matchId));
    } catch (err) {
      console.error('[DEBUG][MATCH UPDATE] Error actualizando partido:', err);
      throw err;
    }

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
