import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SeasonTransitionAssignmentService, TeamAssignmentPlan } from './season-transition-assignment.service';
import { StandingsService } from '../standings/standings.service';
import { 
  divisionTable, 
  leagueTable, 
  seasonTable, 
  teamLeagueAssignmentTable,
  teamTable,
  matchTable,
  AssignmentReason,
  MatchStatus
} from '../database/schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { DATABASE_PROVIDER } from '../database/database.module';
import { PlayoffStatusService } from '../services/playoff-status.service';

export interface PlayoffMatchup {
  round: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  scheduledDate: Date;
  matchday: number;
  leagueId: number;
  seasonId: number;
  isPlayoff: boolean;
}

export interface SeasonTransitionResult {
  message: string;
  processedDivisions: number;
  directPromotions: number;
  directRelegations: number;
  playoffTeams: number;
  playoffMatches: number;
  tournamentQualifiers: number;
  errors: string[];
}

export interface PlayoffResult {
  homeTeamId: number;
  awayTeamId: number;
  homeGoals: number;
  awayGoals: number;
  round: string;
  winnerId: number;
  isComplete: boolean;
}

export interface SeasonClosureReport {
  currentSeasonId: number;
  nextSeasonId?: number;
  promotions: { teamId: number; teamName: string; fromDivision: number; toDivision: number }[];
  relegations: { teamId: number; teamName: string; fromDivision: number; toDivision: number }[];
  playoffResults: PlayoffResult[];
  tournamentQualifiers: { teamId: number; teamName: string; divisionLevel: number }[];
  pendingPlayoffs: { divisionId: number; divisionName: string; teamsCount: number }[];
  errors: string[];
}

@Injectable()
export class SeasonTransitionService {
  private readonly logger = new Logger(SeasonTransitionService.name);

  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
    private readonly assignmentService: SeasonTransitionAssignmentService,
    private readonly standingsService: StandingsService,
    private readonly playoffStatusService: PlayoffStatusService,
  ) {}

  /**
   * Asigna a los equipos descendidos a los slots vacantes de las ligas/grupos de la división inferior
   * Debe ejecutarse tras playoffs, antes de crear la nueva temporada
   * Para cada equipo que asciende, marca su liga/grupo de origen como vacante
   * Para cada descendido, asigna leagueNextSeason a ese slot vacante
   */
  async assignRelegatedTeamsToVacantSlots(seasonId: number): Promise<void> {
    const db = this.databaseService.db;
    this.logger.log('--- [Asignación de descendidos a vacantes] ---');
    // Obtener todas las divisiones ordenadas de mayor a menor (para procesar descensos)
    const divisions = await db
      .select()
      .from(divisionTable)
      .orderBy(desc(divisionTable.level));

    for (const division of divisions) {
      // Saltar la última división (no tiene inferior)
      const lowerDivisionLevel = Number(division.level) + 1;
      const [lowerDivision] = await db
        .select()
        .from(divisionTable)
        .where(eq(divisionTable.level, lowerDivisionLevel));
      if (!lowerDivision) continue;

      // Obtener ligas de la división actual y de la inferior
      const currentLeagues = await db
        .select({ id: leagueTable.id, groupCode: leagueTable.groupCode, name: leagueTable.name })
        .from(leagueTable)
        .where(eq(leagueTable.divisionId, division.id));
      const lowerLeagues = await db
        .select({ id: leagueTable.id, groupCode: leagueTable.groupCode, name: leagueTable.name })
        .from(leagueTable)
        .where(eq(leagueTable.divisionId, lowerDivision.id));

      // LOG extra: divisiones y ligas detectadas
      this.logger.log(`[DEBUG] División actual: ${division.level} (${division.id}) - Ligas: ${currentLeagues.map(l => `${l.name}[${l.groupCode}]`).join(', ')}`);
      this.logger.log(`[DEBUG] División inferior: ${lowerDivision.level} (${lowerDivision.id}) - Ligas: ${lowerLeagues.map(l => `${l.name}[${l.groupCode}]`).join(', ')}`);

      // 1. Identificar equipos que ascienden desde la división inferior
      const promoted = await db
        .select({
          teamId: teamLeagueAssignmentTable.teamId,
          leagueId: teamLeagueAssignmentTable.leagueId
        })
        .from(teamLeagueAssignmentTable)
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            inArray(teamLeagueAssignmentTable.leagueId, lowerLeagues.map(l => l.id)),
            eq(teamLeagueAssignmentTable.promotedNextSeason, true)
          )
        );

      // 2. Marcar slots vacantes en lowerLeagues (por cada equipo que asciende, su liga queda vacante)
      // Mapeo: leagueId -> vacante
      const vacantSlots: number[] = promoted.map(p => p.leagueId);

      // 3. Identificar equipos que descienden de la división actual
      const relegated = await db
        .select({
          teamId: teamLeagueAssignmentTable.teamId,
          leagueId: teamLeagueAssignmentTable.leagueId
        })
        .from(teamLeagueAssignmentTable)
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            inArray(teamLeagueAssignmentTable.leagueId, currentLeagues.map(l => l.id)),
            eq(teamLeagueAssignmentTable.relegatedNextSeason, true)
          )
        );

      // Obtener nombres de equipos y ligas para logs
      const promotedTeams = await Promise.all(promoted.map(async p => {
        const [team] = await db.select({ name: teamTable.name }).from(teamTable).where(eq(teamTable.id, p.teamId));
        const [league] = lowerLeagues.filter(l => l.id === p.leagueId);
        return { teamName: team?.name, leagueId: p.leagueId, groupCode: league?.groupCode, leagueName: league?.name };
      }));
      const relegatedTeams = await Promise.all(relegated.map(async r => {
        const [team] = await db.select({ name: teamTable.name }).from(teamTable).where(eq(teamTable.id, r.teamId));
        const [league] = currentLeagues.filter(l => l.id === r.leagueId);
        return { teamName: team?.name, leagueId: r.leagueId, groupCode: league?.groupCode, leagueName: league?.name };
      }));

      // LOG extra: equipos detectados
      this.logger.log(`[DEBUG] División ${division.level} → ${lowerDivision.level}: Ascendidos detectados (${promotedTeams.length}): ${promotedTeams.map(t => `${t.teamName} [${t.leagueName}/${t.groupCode}]`).join(', ')}`);
      this.logger.log(`[DEBUG] División ${division.level} → ${lowerDivision.level}: Descendidos detectados (${relegatedTeams.length}): ${relegatedTeams.map(t => `${t.teamName} [${t.leagueName}/${t.groupCode}]`).join(', ')}`);
      this.logger.log(`[DEBUG] División ${division.level} → ${lowerDivision.level}: Vacantes en grupos de la división inferior: ${vacantSlots.length} (IDs: ${vacantSlots.join(', ')})`);

      this.logger.log(`División ${division.level} → ${lowerDivision.level}`);
      this.logger.log(`  Ascendidos (${promotedTeams.length}): ${promotedTeams.map(t => `${t.teamName} [${t.groupCode}]`).join(', ')}`);
      this.logger.log(`  Descendidos (${relegatedTeams.length}): ${relegatedTeams.map(t => `${t.teamName} [${t.groupCode}]`).join(', ')}`);
      this.logger.log(`  Vacantes en grupos de la división inferior: ${vacantSlots.length}`);

      // 4. Asignar a cada descendido un slot vacante (uno a uno)
      for (let i = 0; i < relegated.length && i < vacantSlots.length; i++) {
        const relegatedTeam = relegatedTeams[i];
        const targetLeague = lowerLeagues.find(l => l.id === vacantSlots[i]);
        this.logger.log(`    - ${relegatedTeam.teamName} baja de grupo ${relegatedTeam.groupCode} a grupo ${targetLeague?.groupCode}`);
        await db.update(teamLeagueAssignmentTable)
          .set({ leagueNextSeason: vacantSlots[i], updatedAt: new Date() })
          .where(
            and(
              eq(teamLeagueAssignmentTable.seasonId, seasonId),
              eq(teamLeagueAssignmentTable.teamId, relegated[i].teamId)
            )
          );
      }
      if (relegated.length > vacantSlots.length) {
        this.logger.warn(`⚠️ Hay más descendidos (${relegated.length}) que vacantes (${vacantSlots.length}) en División ${division.level}. Los equipos sobrantes no se asignan automáticamente.`);
      }
    }
    this.logger.log('--- [Fin asignación de descendidos] ---');
  }

  /**
   * Procesa el cierre de temporada y prepara la siguiente
   * @param currentSeasonId ID de la temporada que se cierra
   * @param nextSeasonId ID de la nueva temporada (debe estar creada)
   */
  async processSeasonTransition(currentSeasonId: number, nextSeasonId?: number): Promise<SeasonTransitionResult> {
    const db = this.databaseService.db;
    
    // Log eliminado
    
    // Verificar que la temporada actual existe
    const [currentSeason] = await db
      .select()
      .from(seasonTable)
      .where(eq(seasonTable.id, currentSeasonId));
      
    if (!currentSeason) {
      throw new NotFoundException(`No se encontró la temporada con ID ${currentSeasonId}`);
    }
    
    // Si se proporciona nextSeasonId, verificar que existe
    let nextSeason;
    if (nextSeasonId) {
      [nextSeason] = await db
        .select()
        .from(seasonTable)
        .where(eq(seasonTable.id, nextSeasonId));
        
      if (!nextSeason) {
        throw new NotFoundException(`No se encontró la próxima temporada con ID ${nextSeasonId}`);
      }
    }
    
    // Resultado general del proceso
    const result: SeasonTransitionResult = {
      message: '',
      processedDivisions: 0,
      directPromotions: 0,
      directRelegations: 0,
      playoffTeams: 0,
      playoffMatches: 0,
      tournamentQualifiers: 0,
      errors: []
    };
    
    // Obtener todas las divisiones ordenadas por nivel (ascendente)
    const divisions = await db
      .select()
      .from(divisionTable)
      .orderBy(asc(divisionTable.level));
      
    // Procesar cada división
    for (const division of divisions) {
      try {
        // Log eliminado
        
        // Procesar clasificación final, ascensos y descensos
        const divisionResult = await this.processDivision(division.id, currentSeasonId, nextSeasonId);
        
        // Actualizar estadísticas globales
        result.processedDivisions++;
        result.directPromotions += divisionResult.directPromotions;
        result.directRelegations += divisionResult.directRelegations;
        result.playoffTeams += divisionResult.playoffTeams;
        result.tournamentQualifiers += divisionResult.tournamentQualifiers;
        
        // Si hay equipos para playoff, generar los partidos
        if (divisionResult.playoffTeams > 0 && Number(division.promotePlayoffSlots || 0) > 0) {
          const playoffMatches = await this.organizePlayoffs(division.id, currentSeasonId);
          result.playoffMatches += playoffMatches.length;
        }
      } catch (error) {
        this.logger.error(`Error procesando división ${division.level}:`, error);
        result.errors.push(`Error en División ${division.level}: ${error.message}`);
      }
    }
    
    // Mensaje de resultado
    result.message = result.errors.length === 0 
      ? `Transición de temporada completada exitosamente. Procesadas ${result.processedDivisions} divisiones.`
      : `Transición de temporada completada con ${result.errors.length} errores.`;
      
    return result;
  }
  
  /**
   * Procesa una división específica: ascensos, descensos y clasificaciones a torneos
   */
  private async processDivision(
    divisionId: number, 
    currentSeasonId: number,
    nextSeasonId?: number
  ): Promise<{
    directPromotions: number;
    directRelegations: number;
    playoffTeams: number;
    tournamentQualifiers: number;
  }> {
    const db = this.databaseService.db;

    // Obtener información de la división
    const [division] = await db
      .select()
      .from(divisionTable)
      .where(eq(divisionTable.id, divisionId));
      
    if (!division) {
      throw new NotFoundException(`División no encontrada: ${divisionId}`);
    }

    // --- RESETEAR FLAGS DE PLAYOFF PARA TODOS LOS EQUIPOS DE LA DIVISIÓN EN LA TEMPORADA ACTUAL ---
    // Buscar todas las ligas de la división
    const leaguesToReset = await db
      .select({ id: leagueTable.id })
      .from(leagueTable)
      .where(eq(leagueTable.divisionId, divisionId));
    const leagueIdsToReset = leaguesToReset.map(l => l.id);
    if (leagueIdsToReset.length > 0) {
      await db
        .update(teamLeagueAssignmentTable)
        .set({ playoffNextSeason: false, updatedAt: new Date() })
        .where(
          and(
            inArray(teamLeagueAssignmentTable.leagueId, leagueIdsToReset),
            eq(teamLeagueAssignmentTable.seasonId, currentSeasonId)
          )
        );
    }
    // --- FIN RESET ---

    // Obtener todas las ligas de esta división
    const leagues = await db
      .select()
      .from(leagueTable)
      .where(eq(leagueTable.divisionId, divisionId));
      
    // Contadores
    let directPromotions = 0;
    let directRelegations = 0;
    let playoffTeams = 0;
    let tournamentQualifiers = 0;      // Procesar cada liga de la división
      for (const league of leagues) {
        // Usar la nueva función unificada que calcula clasificación y aplica consecuencias
        // Solo limpiar promotedNextSeason si NO hay playoffs en la división
        const hasActivePlayoffs = await this.playoffStatusService.isPlayoffActiveForDivision(currentSeasonId, division.id);
        const resetPromotionFlag = !hasActivePlayoffs;
        const result = await this.standingsService.calculateStandingsWithConsequences(
          currentSeasonId, 
          league.id, 
          true, // Aplicar consecuencias automáticamente
          resetPromotionFlag // Limpiar promotedNextSeason solo si no hay playoffs
        );
        
        // Verificar si hay clasificación para esta liga
        if (result.standings.length === 0) {
          this.logger.warn(`No hay clasificación disponible para la liga ${league.name} (ID: ${league.id})`);
          continue;
        }
        
        // Actualizar contadores globales
        directPromotions += result.consequences.directPromotions;
        directRelegations += result.consequences.directRelegations;
        playoffTeams += result.consequences.playoffTeams;
        tournamentQualifiers += result.consequences.tournamentQualifiers;
        
        // Log eliminado
      }
    
    return {
      directPromotions,
      directRelegations,
      playoffTeams,
      tournamentQualifiers
    };
  }
  
  /**
   * Organiza los playoffs para una división
   */
  async organizePlayoffs(
    divisionId: number,
    seasonId: number
  ): Promise<PlayoffMatchup[]> {
    const db = this.databaseService.db;
    
    // Verificar que la división existe y tiene playoffs configurados
    const [division] = await db
      .select()
      .from(divisionTable)
      .where(eq(divisionTable.id, divisionId));
      
    if (!division) {
      throw new NotFoundException(`División no encontrada: ${divisionId}`);
    }
    
    if (!division.promotePlayoffSlots || division.promotePlayoffSlots <= 0) {
      // Log eliminado
      return [];
    }
    
    // Verificar que la temporada regular está completa
    const isComplete = await this.isDivisionRegularSeasonComplete(divisionId, seasonId);
    if (!isComplete) {
      throw new BadRequestException(`La temporada regular de ${division.name} no está completa`);
    }
    
    // Verificar que no existen ya playoffs para esta división
    const leagues = await db
      .select()
      .from(leagueTable)
      .where(eq(leagueTable.divisionId, divisionId));
      
    if (leagues.length === 0) {
      throw new NotFoundException(`No hay ligas en la división ${division.name}`);
    }
    
    const leagueIds = leagues.map(l => l.id);
    
    const [existingPlayoffs] = await db
      .select({ count: sql<number>`count(*)` })
      .from(matchTable)
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          inArray(matchTable.leagueId, leagueIds),
          eq(matchTable.isPlayoff, true)
        )
      );
    
    if (Number(existingPlayoffs.count) > 0) {
      this.logger.warn(`Ya existen ${existingPlayoffs.count} partidos de playoff para la división ${division.name}`);
      return [];
    }
    
    // Si solo hay una liga en la división, emparejamientos internos
    if (leagues.length === 1) {
      return this.organizeSingleLeaguePlayoff(leagues[0].id, seasonId, division);
    } else {
      // Múltiples ligas: emparejamientos cruzados
      return this.organizeMultiLeaguePlayoff(leagues, seasonId, division);
    }
  }
  
  /**
   * Organiza playoffs para una división con una sola liga
   */
  private async organizeSingleLeaguePlayoff(
    leagueId: number,
    seasonId: number,
    division: any
  ): Promise<PlayoffMatchup[]> {
    // Leer clasificaciones existentes (deberían estar actualizadas tras los partidos)
    const standings = await this.standingsService.calculateStandings(seasonId, leagueId);
    
    // Obtener equipos clasificados al playoff
    const startPos = Number(division.promoteSlots || 0) + 1; // +1 porque positions son 1-indexed
    const endPos = startPos + Number(division.promotePlayoffSlots || 0) - 1;
    
    const playoffTeams = standings.filter(team => 
      team.position >= startPos && team.position <= endPos
    );
    
    // Log eliminado
    
    // Verificar que hay suficientes equipos
    if (playoffTeams.length < Number(division.promotePlayoffSlots || 0)) {
      this.logger.warn(`No hay suficientes equipos para el playoff. Requeridos: ${division.promotePlayoffSlots}, encontrados: ${playoffTeams.length}`);
      return [];
    }
    
    // Crear emparejamientos (mejor vs peor)
    const matchups: PlayoffMatchup[] = [];
    const startDate = new Date(); // Establecer fecha de inicio adecuada
    startDate.setDate(startDate.getDate() + 7); // Una semana después del fin de temporada
    
    // Semifinales - PARTIDO ÚNICO (formato clásico)
    if (playoffTeams.length === 4) {
      // Semifinal 1: mejor vs peor (3º vs 6º)
      matchups.push({
        round: 'Semifinal',
        homeTeamId: playoffTeams[0].teamId, // 3º (mejor clasificado - local)
        homeTeamName: playoffTeams[0].teamName,
        awayTeamId: playoffTeams[3].teamId, // 6º (peor clasificado - visitante)
        awayTeamName: playoffTeams[3].teamName,
        scheduledDate: new Date(startDate),
        matchday: 1,
        leagueId: leagueId,
        seasonId: seasonId,
        isPlayoff: true
      });
      
      // Semifinal 2: segundo mejor vs segundo peor (4º vs 5º)
      matchups.push({
        round: 'Semifinal',
        homeTeamId: playoffTeams[1].teamId, // 4º (segundo mejor - local)
        homeTeamName: playoffTeams[1].teamName,
        awayTeamId: playoffTeams[2].teamId, // 5º (segundo peor - visitante)
        awayTeamName: playoffTeams[2].teamName,
        scheduledDate: new Date(startDate),
        matchday: 1,
        leagueId: leagueId,
        seasonId: seasonId,
        isPlayoff: true
      });
      
      // Logs eliminados
      
      // NOTA: La final se creará automáticamente cuando se simulen las semifinales
    }
    
    // Crear los partidos en la base de datos
    await this.createPlayoffMatches(matchups);
    
    return matchups;
  }
  
  /**
   * Organiza playoffs para una división con múltiples ligas
   */
  private async organizeMultiLeaguePlayoff(
    leagues: any[],
    seasonId: number,
    division: any
  ): Promise<PlayoffMatchup[]> {
    const db = this.databaseService.db;
    const matchups: PlayoffMatchup[] = [];
    
    // Para cada liga, obtener equipos clasificados a playoff
    const leaguePlayoffTeams: {
      leagueId: number;
      leagueName: string;
      groupCode: string;
      teams: { teamId: number; teamName: string; position: number; }[];
    }[] = [];
    
    for (const league of leagues) {
      // Leer clasificaciones existentes (deberían estar actualizadas tras los partidos)
      const standings = await this.standingsService.calculateStandings(seasonId, league.id);
      
      let playoffTeams: { teamId: number; teamName: string; position: number; }[] = [];
      
      // Lógica específica para cada división
      if (Number(division.level) === 3) {
        // División 3: 2º y 3º de cada grupo
        playoffTeams = standings.filter(team => 
          team.position === 2 || team.position === 3
        ).map(team => ({
          teamId: team.teamId,
          teamName: team.teamName,
          position: team.position
        }));
      } else if (Number(division.level) === 4 || Number(division.level) === 5) {
        // División 4 y 5: solo 2º de cada grupo
        playoffTeams = standings.filter(team => 
          team.position === 2
        ).map(team => ({
          teamId: team.teamId,
          teamName: team.teamName,
          position: team.position
        }));
      } else {
        // Otras divisiones: usar la lógica original
        const startPos = Number(division.promoteSlots || 0) + 1; // +1 porque positions son 1-indexed
        const endPos = startPos + (Number(division.promotePlayoffSlots || 0) / leagues.length) - 1;
        
        playoffTeams = standings.filter(team => 
          team.position >= startPos && team.position <= endPos
        ).map(team => ({
          teamId: team.teamId,
          teamName: team.teamName,
          position: team.position
        }));
      }
        
      leaguePlayoffTeams.push({
        leagueId: league.id,
        leagueName: league.name,
        groupCode: league.groupCode,
        teams: playoffTeams
      });
    }
    
    // Verificar que hay datos de todas las ligas
    if (leaguePlayoffTeams.some(lpt => lpt.teams.length === 0)) {
      this.logger.warn(`Algunas ligas no tienen equipos clasificados para playoff`);
      return [];
    }
    
    // Crear emparejamientos cruzados
    // Ejemplo: si hay 2 ligas y 4 equipos en playoff total (2 por liga)
    // 2ºA vs 3ºB, 2ºB vs 3ºA
    
    const startDate = new Date(); // Establecer fecha de inicio adecuada
    startDate.setDate(startDate.getDate() + 7); // Una semana después del fin de temporada
    
    // Lógica específica según el número de grupos y división
    if (leagues.length === 2 && Number(division.level) === 3) {
      // División 3: 2 grupos, 2º y 3º de cada grupo
      await this.createDivision3Playoffs(leaguePlayoffTeams, matchups, startDate, seasonId);
    } else if (leagues.length === 4 && Number(division.level) === 4) {
      // División 4: 4 grupos, 2º de cada grupo
      await this.createDivision4Playoffs(leaguePlayoffTeams, matchups, startDate, seasonId);
    } else if (leagues.length === 8 && Number(division.level) === 5) {
      // División 5: 8 grupos, 2º de cada grupo
      await this.createDivision5Playoffs(leaguePlayoffTeams, matchups, startDate, seasonId);
    } else {
      this.logger.warn(`Configuración de playoff no soportada: ${leagues.length} grupos en División ${division.level}`);
      return [];
    }
    
    // Crear los partidos en la base de datos
    await this.createPlayoffMatches(matchups);
    
    return matchups;
  }
  
  /**
   * Crea partidos de playoff en la base de datos
   */
  private async createPlayoffMatches(matchups: PlayoffMatchup[]): Promise<void> {
    if (matchups.length === 0) return;
    
    const db = this.databaseService.db;
    
    const matchesToInsert = matchups.map(matchup => ({
      seasonId: matchup.seasonId,
      leagueId: matchup.leagueId,
      homeTeamId: matchup.homeTeamId,
      awayTeamId: matchup.awayTeamId,
      matchday: matchup.matchday,
      scheduledDate: matchup.scheduledDate,
      status: MatchStatus.SCHEDULED,
      isPlayoff: true,
      playoffRound: matchup.round,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    await db.insert(matchTable).values(matchesToInsert);
  }
  
  /**
   * Finaliza la temporada: cierra la temporada actual y configura la siguiente
   */
  async finalizeSeason(currentSeasonId: number, nextSeasonId?: number, createNext: boolean = false): Promise<any> {
    const db = this.databaseService.db;
    
    // Verificar que la temporada actual existe y está activa
    const [currentSeason] = await db
      .select()
      .from(seasonTable)
      .where(
        and(
          eq(seasonTable.id, currentSeasonId),
          eq(seasonTable.isActive, true)
        )
      );
      
    if (!currentSeason) {
      throw new NotFoundException(`La temporada ${currentSeasonId} no existe o no está activa`);
    }
    
    // Si nextSeasonId no se proporciona y createNext es true, crear nueva temporada
    if (!nextSeasonId && createNext) {
      const nextYear = currentSeason.year + 1;
      
      const [newSeason] = await db
        .insert(seasonTable)
        .values({
          name: `Temporada ${nextYear}`,
          year: nextYear,
          isActive: false,
          startDate: null,
          endDate: null
        })
        .returning();
        
      nextSeasonId = newSeason.id;
    }
    
    // Procesar transición de temporada
    const transitionResult = await this.processSeasonTransition(currentSeasonId, nextSeasonId);
    
    // Marcar temporada actual como finalizada
    await db
      .update(seasonTable)
      .set({
        isActive: false,
        endDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(seasonTable.id, currentSeasonId));
      
    // Si se proporcionó nextSeasonId, activar la siguiente temporada
    if (nextSeasonId) {
      await db
        .update(seasonTable)
        .set({
          isActive: true,
          startDate: new Date(),
          updatedAt: new Date()
        })
        .where(eq(seasonTable.id, nextSeasonId));
    }
    
    return {
      message: `Temporada ${currentSeason.name} finalizada correctamente`,
      currentSeason: currentSeason.id,
      nextSeason: nextSeasonId,
      transitionResult
    };
  }
  
  /**
   * Organiza playoffs para todas las divisiones listas en la temporada activa
   */
  async organizePlayoffsForAllReadyDivisions(): Promise<{ message: string; playoffMatches: number }> {
    const db = this.databaseService.db;
    
    // Obtener temporada activa
    const [activeSeason] = await db
      .select()
      .from(seasonTable)
      .where(eq(seasonTable.isActive, true));
      
    if (!activeSeason) {
      throw new NotFoundException('No hay temporada activa');
    }
    
    let totalPlayoffMatches = 0;
    const processedDivisions: string[] = [];
    
    // Obtener todas las divisiones
    const divisions = await db
      .select()
      .from(divisionTable)
      .orderBy(asc(divisionTable.level));
      
    for (const division of divisions) {
      // Verificar si la división tiene playoffs configurados
      if (!division.promotePlayoffSlots || division.promotePlayoffSlots <= 0) {
        continue;
      }
      
      // Obtener ligas de esta división
      const leagues = await db
        .select({ id: leagueTable.id })
        .from(leagueTable)
        .where(eq(leagueTable.divisionId, division.id));
        
      if (leagues.length === 0) continue;
      
      const leagueIds = leagues.map(l => l.id);
      
      // Verificar si la división está completa y sin playoffs
      const [pendingCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(matchTable)
        .where(
          and(
            eq(matchTable.seasonId, activeSeason.id),
            inArray(matchTable.leagueId, leagueIds),
            eq(matchTable.status, MatchStatus.SCHEDULED),
            sql`${matchTable.isPlayoff} IS NOT TRUE`
          )
        );
        
      const [playoffCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(matchTable)
        .where(
          and(
            eq(matchTable.seasonId, activeSeason.id),
            inArray(matchTable.leagueId, leagueIds),
            eq(matchTable.isPlayoff, true)
          )
        );
      
      const isCompleted = Number(pendingCount.count) === 0;
      const hasPlayoffs = Number(playoffCount.count) > 0;
      
      if (isCompleted && !hasPlayoffs) {
        try {
          const playoffMatches = await this.organizePlayoffs(division.id, activeSeason.id);
          totalPlayoffMatches += playoffMatches.length;
          processedDivisions.push(division.name);
          
          // Log eliminado
        } catch (error) {
          this.logger.warn(`No se pudieron generar playoffs para ${division.name}: ${error.message}`);
        }
      }
    }
    
    return {
      message: `Playoffs organizados para ${processedDivisions.length} divisiones: ${processedDivisions.join(', ')}`,
      playoffMatches: totalPlayoffMatches
    };
  }

  /**
   * Cierra la temporada activa actual
   * Método de conveniencia que obtiene la temporada activa y llama a finalizeSeason
   */
  async closeCurrentSeason(createNextSeason: boolean = false): Promise<SeasonTransitionResult> {
    const activeSeason = await this.getActiveSeason();
    return this.finalizeSeason(activeSeason.id, undefined, createNextSeason);
  }

  /**
   * Verifica si una división ha completado todos sus partidos regulares
   */
  async isDivisionRegularSeasonComplete(divisionId: number, seasonId: number): Promise<boolean> {
    const db = this.databaseService.db;
    
    // Obtener ligas de la división
    const leagues = await db
      .select({ id: leagueTable.id })
      .from(leagueTable)
      .where(eq(leagueTable.divisionId, divisionId));
      
    if (leagues.length === 0) return false;
    
    const leagueIds = leagues.map(l => l.id);
    
    // Verificar si hay partidos pendientes
    const [pendingMatches] = await db
      .select({ count: sql<number>`count(*)` })
      .from(matchTable)
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          inArray(matchTable.leagueId, leagueIds),
          eq(matchTable.isPlayoff, false),
          eq(matchTable.status, MatchStatus.SCHEDULED)
        )
      );
      
    return Number(pendingMatches.count) === 0;
  }
  
  /**
   * Verifica si los playoffs de una división están completos
   */
  async areDivisionPlayoffsComplete(divisionId: number, seasonId: number): Promise<boolean> {
    const db = this.databaseService.db;
    
    // Log eliminado: debug playoffs
    
    // Obtener ligas de la división
    const leagues = await db
      .select({ id: leagueTable.id })
      .from(leagueTable)
      .where(eq(leagueTable.divisionId, divisionId));
      
    if (leagues.length === 0) {
      // Log eliminado: debug playoffs
      return true; // Si no hay ligas, no hay playoffs pendientes
    }

    const leagueIds = leagues.map(l => l.id);
    // Log eliminado: debug playoffs
    
    // Verificar si hay partidos de playoff pendientes
    const [pendingPlayoffs] = await db
      .select({ count: sql<number>`count(*)` })
      .from(matchTable)
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          inArray(matchTable.leagueId, leagueIds),
          eq(matchTable.isPlayoff, true),
          eq(matchTable.status, MatchStatus.SCHEDULED)
        )
      );
      
    const pendingCount = Number(pendingPlayoffs.count);
    // Log eliminado: debug playoffs
    
    return pendingCount === 0;
  }
  
  /**
   * Ejecuta una transición completa de temporada con asignaciones inteligentes
   */
  async executeCompleteSeasonTransition(
    currentSeasonId: number,
    nextSeasonName?: string
  ): Promise<{
    currentSeasonClosed: boolean;
    nextSeasonCreated: boolean;
    nextSeasonId?: number;
    assignmentPlan: TeamAssignmentPlan[];
    assignmentResults: { success: number; errors: string[] };
    transitionReport: SeasonClosureReport;
  }> {
    const db = this.databaseService.db;
    
    // Log eliminado
    
    // 1. Verificar que la temporada está completamente terminada
    const seasonStatus = await this.isSeasonCompletelyFinished(currentSeasonId);
    const transitionReport = seasonStatus.report;
    
    // 2. Verificar que todas las divisiones están listas
    if (!seasonStatus.isComplete) {
      throw new BadRequestException(
        `No se puede procesar la transición. Problemas pendientes: ${seasonStatus.pendingIssues.join(', ')}`
      );
    }
    
    // 3. Crear nueva temporada
    const [currentSeason] = await db
      .select()
      .from(seasonTable)
      .where(eq(seasonTable.id, currentSeasonId));
      
    if (!currentSeason) {
      throw new NotFoundException(`Temporada ${currentSeasonId} no encontrada`);
    }
    
    const nextYear = currentSeason.year + 1;
    const seasonName = nextSeasonName || `Temporada ${nextYear}`;
    
    const [nextSeason] = await db
      .insert(seasonTable)
      .values({
        name: seasonName,
        year: nextYear,
        isActive: false,
        startDate: null,
        endDate: null
      })
      .returning();
    
    // 4. Generar plan de asignaciones
    const assignmentPlan = await this.assignmentService.generateNextSeasonAssignmentPlan(
      currentSeasonId,
      nextSeason.id
    );
    
    // 5. Ejecutar asignaciones
    const assignmentResults = await this.assignmentService.executeAssignmentPlan(
      assignmentPlan,
      nextSeason.id
    );
    
    // 6. Cerrar temporada actual
    await db
      .update(seasonTable)
      .set({
        isActive: false,
        isCompleted: true,
        endDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(seasonTable.id, currentSeasonId));
    
    // 7. Activar nueva temporada
    await db
      .update(seasonTable)
      .set({
        isActive: true,
        startDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(seasonTable.id, nextSeason.id));
    
    // Log eliminado
    
    return {
      currentSeasonClosed: true,
      nextSeasonCreated: true,
      nextSeasonId: nextSeason.id,
      assignmentPlan,
      assignmentResults,
      transitionReport
    };
  }

  /**
   * Verifica si la temporada está completamente terminada y lista para crear una nueva
   * VERSIÓN SIMPLIFICADA - Lee datos ya calculados en lugar de recalcular
   */
  async isSeasonCompletelyFinished(seasonId: number): Promise<{
    isComplete: boolean;
    report: SeasonClosureReport;
    readyForNewSeason: boolean;
    pendingIssues: string[];
  }> {
    const db = this.databaseService.db;
    // Log eliminado: progreso/debug
    
    const pendingIssues: string[] = [];
    
    // 1. Verificar partidos regulares pendientes
    const [pendingRegularMatches] = await db
      .select({ count: sql<number>`count(*)` })
      .from(matchTable)
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          eq(matchTable.isPlayoff, false),
          eq(matchTable.status, MatchStatus.SCHEDULED)
        )
      );
    
    const regularPending = Number(pendingRegularMatches.count);
    if (regularPending > 0) {
      pendingIssues.push(`${regularPending} partidos regulares pendientes`);
    }
    
    // 2. Verificar partidos de playoffs pendientes
    const [pendingPlayoffMatches] = await db
      .select({ count: sql<number>`count(*)` })
      .from(matchTable)
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          eq(matchTable.isPlayoff, true),
          eq(matchTable.status, MatchStatus.SCHEDULED)
        )
      );
    
    const playoffsPending = Number(pendingPlayoffMatches.count);
    if (playoffsPending > 0) {
      pendingIssues.push(`${playoffsPending} partidos de playoffs pendientes`);
    }
    
    // 3. Leer datos ya calculados de ascensos/descensos
    const promotions = await db
      .select({
        teamId: teamTable.id,
        teamName: teamTable.name,
        divisionLevel: divisionTable.level
      })
      .from(teamLeagueAssignmentTable)
      .innerJoin(teamTable, eq(teamLeagueAssignmentTable.teamId, teamTable.id))
      .innerJoin(leagueTable, eq(teamLeagueAssignmentTable.leagueId, leagueTable.id))
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .where(
        and(
          eq(teamLeagueAssignmentTable.seasonId, seasonId),
          eq(teamLeagueAssignmentTable.promotedNextSeason, true)
        )
      );
    
    const relegations = await db
      .select({
        teamId: teamTable.id,
        teamName: teamTable.name,
        divisionLevel: divisionTable.level
      })
      .from(teamLeagueAssignmentTable)
      .innerJoin(teamTable, eq(teamLeagueAssignmentTable.teamId, teamTable.id))
      .innerJoin(leagueTable, eq(teamLeagueAssignmentTable.leagueId, leagueTable.id))
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .where(
        and(
          eq(teamLeagueAssignmentTable.seasonId, seasonId),
          eq(teamLeagueAssignmentTable.relegatedNextSeason, true)
        )
      );
    
    const tournamentQualifiers = await db
      .select({
        teamId: teamTable.id,
        teamName: teamTable.name,
        divisionLevel: divisionTable.level
      })
      .from(teamLeagueAssignmentTable)
      .innerJoin(teamTable, eq(teamLeagueAssignmentTable.teamId, teamTable.id))
      .innerJoin(leagueTable, eq(teamLeagueAssignmentTable.leagueId, leagueTable.id))
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .where(
        and(
          eq(teamLeagueAssignmentTable.seasonId, seasonId),
          eq(teamLeagueAssignmentTable.qualifiedForTournament, true)
        )
      );
    
    // 4. Construir reporte simplificado con datos ya calculados
    const report: SeasonClosureReport = {
      currentSeasonId: seasonId,
      promotions: promotions.map(p => ({
        teamId: p.teamId,
        teamName: p.teamName,
        fromDivision: p.divisionLevel,
        toDivision: p.divisionLevel - 1
      })),
      relegations: relegations.map(r => ({
        teamId: r.teamId,
        teamName: r.teamName,
        fromDivision: r.divisionLevel,
        toDivision: r.divisionLevel + 1
      })),
      playoffResults: [], // Ya no necesario, datos están en assignments
      tournamentQualifiers: tournamentQualifiers.map(t => ({
        teamId: t.teamId,
        teamName: t.teamName,
        divisionLevel: t.divisionLevel
      })),
      pendingPlayoffs: [], // Ya verificado arriba
      errors: []
    };
    
    const isComplete = pendingIssues.length === 0;
    const readyForNewSeason = isComplete;
    
    // Logs eliminados: progreso/debug
    
    return {
      isComplete,
      report,
      readyForNewSeason,
      pendingIssues
    };
  }

  /**
   * Crea una nueva temporada cuando la actual esté completamente terminada
   * Incluye la transición automática de equipos ascendidos/descendidos
   */
  async createNewSeasonFromCompleted(
    completedSeasonId: number,
    newSeasonName?: string
  ): Promise<{
    success: boolean;
    message: string;
    newSeasonId?: number;
    newSeasonName?: string;
    previousSeasonClosed: boolean;
    transitionSummary: {
      promotedTeams: number;
      relegatedTeams: number;
      tournamentQualified: number;
      teamsTransitioned: number;
    };
  }> {
    const db = this.databaseService.db;
    
    // Log eliminado: progreso/debug
    
    // 1. Verificar que la temporada está completamente terminada
    const seasonStatus = await this.isSeasonCompletelyFinished(completedSeasonId);
    
    // Log eliminado: progreso/debug
    
    if (!seasonStatus.readyForNewSeason) {
      const errorMsg = `La temporada no está lista para crear una nueva. Problemas pendientes: ${seasonStatus.pendingIssues.join(', ')}`;
      this.logger.error(`[DEBUG] ${errorMsg}`);
      throw new BadRequestException(errorMsg);
    }
    
    // 2. Obtener información de la temporada actual
    const [currentSeason] = await db
      .select()
      .from(seasonTable)
      .where(eq(seasonTable.id, completedSeasonId));
      
    if (!currentSeason) {
      this.logger.error(`[DEBUG] Temporada ${completedSeasonId} no encontrada`);
      throw new NotFoundException(`Temporada ${completedSeasonId} no encontrada`);
    }
    
    // Log eliminado: progreso/debug
    
    // 3. Ejecutar la transición completa
    // Log eliminado: progreso/debug
    const transitionResult = await this.executeCompleteSeasonTransition(
      completedSeasonId,
      newSeasonName
    );
    
    // Log eliminado: progreso/debug
    
    // 4. Preparar resumen de la transición
    const transitionSummary = {
      promotedTeams: seasonStatus.report.promotions.length,
      relegatedTeams: seasonStatus.report.relegations.length,
      tournamentQualified: seasonStatus.report.tournamentQualifiers.length,
      teamsTransitioned: transitionResult.assignmentResults.success
    };
    
    // Log eliminado: progreso/debug
    
    return {
      success: true,
      message: `Nueva temporada "${newSeasonName || `Temporada ${currentSeason.year + 1}`}" creada exitosamente`,
      newSeasonId: transitionResult.nextSeasonId,
      newSeasonName: newSeasonName || `Temporada ${currentSeason.year + 1}`,
      previousSeasonClosed: transitionResult.currentSeasonClosed,
      transitionSummary
    };
  }

  /**
   * Obtiene la temporada activa
   */
  async getActiveSeason() {
    const db = this.databaseService.db;
    
    // Log eliminado: progreso/debug
    
    const [season] = await db
      .select()
      .from(seasonTable)
      .where(eq(seasonTable.isActive, true))
      .limit(1);
    
    if (!season) {
      this.logger.error('[DEBUG SERVICE] No se encontró temporada activa');
      throw new NotFoundException('No hay temporada activa');
    }
    
    // Log eliminado: progreso/debug
    return season;
  }

  /**
   * Crea automáticamente las siguientes rondas de playoff cuando la ronda anterior está completada
   * - Después de cuartos: crea semifinales
   * - Después de semifinales: crea finales
   */
  async createPlayoffFinalsIfNeeded(seasonId: number): Promise<void> {
    const db = this.databaseService.db;
    
    try {
      // 1. Verificar cuartos completados y crear semifinales (División 5)
      await this.createSemifinalsAfterQuarters(seasonId);
      
      // 2. Verificar semifinales completadas y crear finales (todas las divisiones)
      await this.createFinalsAfterSemifinals(seasonId);
      
    } catch (error) {
      this.logger.error('Error creando siguientes rondas de playoff:', error);
    }
  }

  /**
   * Crea semifinales automáticamente cuando los cuartos están completados (División 5)
   */
  private async createSemifinalsAfterQuarters(seasonId: number): Promise<void> {
    const db = this.databaseService.db;
    
    // Buscar cuartos completados
    const completedQuarters = await db
      .select({
        leagueId: matchTable.leagueId,
        seasonId: matchTable.seasonId,
        divisionId: leagueTable.divisionId,
        divisionName: divisionTable.name,
        divisionLevel: divisionTable.level,
        homeTeamId: matchTable.homeTeamId,
        awayTeamId: matchTable.awayTeamId,
        homeGoals: matchTable.homeGoals,
        awayGoals: matchTable.awayGoals
      })
      .from(matchTable)
      .innerJoin(leagueTable, eq(matchTable.leagueId, leagueTable.id))
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          eq(matchTable.isPlayoff, true),
          eq(matchTable.status, MatchStatus.FINISHED),
          eq(matchTable.playoffRound, 'Cuartos')
        )
      );

    if (completedQuarters.length === 0) {
      return; // No hay cuartos completados
    }

    // Agrupar por división
    const quartersByDivision = completedQuarters.reduce((acc, match) => {
      const divKey = `${match.divisionId}`;
      if (!acc[divKey]) {
        acc[divKey] = {
          divisionId: match.divisionId,
          divisionName: match.divisionName,
          divisionLevel: match.divisionLevel,
          leagueId: match.leagueId,
          matches: []
        };
      }
      acc[divKey].matches.push(match);
      return acc;
    }, {} as Record<string, any>);

    // Para División 5, verificar si tiene 4 cuartos completados y crear semifinales
    for (const divKey in quartersByDivision) {
      const divisionData = quartersByDivision[divKey];
      
      if (divisionData.divisionLevel === 5 && divisionData.matches.length === 4) {
        // Verificar que no existen ya semifinales para esta división
        const existingSemifinals = await db
          .select()
          .from(matchTable)
          .innerJoin(leagueTable, eq(matchTable.leagueId, leagueTable.id))
          .where(
            and(
              eq(matchTable.seasonId, seasonId),
              eq(matchTable.isPlayoff, true),
              eq(matchTable.playoffRound, 'Semifinal'),
              eq(leagueTable.divisionId, divisionData.divisionId)
            )
          );

        if (existingSemifinals.length === 0) {
          // Determinar ganadores de cuartos (ordenados por orden original)
          const winners = divisionData.matches.map((match: any) => {
            const homeWon = match.homeGoals > match.awayGoals;
            return homeWon ? match.homeTeamId : match.awayTeamId;
          });

          if (winners.length === 4) {
            // Crear semifinales
            const semifinalDate = new Date();
            semifinalDate.setDate(semifinalDate.getDate() + 7); // Una semana después
            
            // Semifinal 1: Ganador cuarto 1 vs Ganador cuarto 4
            await db.insert(matchTable).values({
              seasonId: seasonId,
              leagueId: divisionData.leagueId,
              homeTeamId: winners[0], // Ganador cuarto 1 (local)
              awayTeamId: winners[3], // Ganador cuarto 4 (visitante)
              matchday: 2, // Semifinal en jornada 2
              scheduledDate: semifinalDate,
              status: MatchStatus.SCHEDULED,
              isPlayoff: true,
              playoffRound: 'Semifinal',
              createdAt: new Date(),
              updatedAt: new Date()
            });

            // Semifinal 2: Ganador cuarto 2 vs Ganador cuarto 3
            await db.insert(matchTable).values({
              seasonId: seasonId,
              leagueId: divisionData.leagueId,
              homeTeamId: winners[1], // Ganador cuarto 2 (local)
              awayTeamId: winners[2], // Ganador cuarto 3 (visitante)
              matchday: 2,
              scheduledDate: semifinalDate,
              status: MatchStatus.SCHEDULED,
              isPlayoff: true,
              playoffRound: 'Semifinal',
              createdAt: new Date(),
              updatedAt: new Date()
            });

            // Logs eliminados
          }
        }
      }
    }
  }

  /**
   * Crea finales automáticamente cuando las semifinales están completadas
   */
  private async createFinalsAfterSemifinals(seasonId: number): Promise<void> {
    const db = this.databaseService.db;
    
    // Buscar semifinales completadas que no tengan final creada
    const completedSemifinals = await db
      .select({
        leagueId: matchTable.leagueId,
        seasonId: matchTable.seasonId,
        divisionId: leagueTable.divisionId,
        divisionName: divisionTable.name,
        divisionLevel: divisionTable.level,
        homeTeamId: matchTable.homeTeamId,
        awayTeamId: matchTable.awayTeamId,
        homeGoals: matchTable.homeGoals,
        awayGoals: matchTable.awayGoals
      })
      .from(matchTable)
      .innerJoin(leagueTable, eq(matchTable.leagueId, leagueTable.id))
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          eq(matchTable.isPlayoff, true),
          eq(matchTable.status, MatchStatus.FINISHED), // SOLO partidos terminados
          eq(matchTable.playoffRound, 'Semifinal'),
          sql`${matchTable.homeGoals} IS NOT NULL AND ${matchTable.awayGoals} IS NOT NULL` // Asegurar que tienen resultado
        )
      );

    if (completedSemifinals.length === 0) {
      return; // No hay semifinales completadas
    }

    // Agrupar por división
    const semiFinalsByDivision = completedSemifinals.reduce((acc, match) => {
      const divKey = `${match.divisionId}`;
      if (!acc[divKey]) {
        acc[divKey] = {
          divisionId: match.divisionId,
          divisionName: match.divisionName,
          divisionLevel: match.divisionLevel,
          leagueId: match.leagueId,
          matches: []
        };
      }
      acc[divKey].matches.push(match);
      return acc;
    }, {} as Record<string, any>);

    // Para cada división, verificar si tiene 2 semifinales completadas y crear final
    for (const divKey in semiFinalsByDivision) {
      const divisionData = semiFinalsByDivision[divKey];
      
      if (divisionData.matches.length === 2) {
        // Verificar que no existe ya una final para esta división
        const existingFinal = await db
          .select()
          .from(matchTable)
          .innerJoin(leagueTable, eq(matchTable.leagueId, leagueTable.id))
          .where(
            and(
              eq(matchTable.seasonId, seasonId),
              eq(matchTable.isPlayoff, true),
              eq(matchTable.playoffRound, 'Final'),
              eq(leagueTable.divisionId, divisionData.divisionId)
            )
          );

        if (existingFinal.length === 0) {
          // Determinar ganadores de semifinales
          const winners = divisionData.matches.map((match: any) => {
            const homeWon = match.homeGoals > match.awayGoals;
            return homeWon ? match.homeTeamId : match.awayTeamId;
          });

          if (winners.length === 2) {
            // Crear final
            const finalDate = new Date();
            finalDate.setDate(finalDate.getDate() + 14); // Dos semanas después de inicio de playoffs
            
            await db.insert(matchTable).values({
              seasonId: seasonId,
              leagueId: divisionData.leagueId,
              homeTeamId: winners[0], // Ganador de primera semifinal (local)
              awayTeamId: winners[1], // Ganador de segunda semifinal (visitante)
              matchday: divisionData.divisionLevel === 5 ? 3 : 2, // División 5: cuartos=1, semis=2, final=3; Otras: semis=1, final=2
              scheduledDate: finalDate,
              status: MatchStatus.SCHEDULED,
              isPlayoff: true,
              playoffRound: 'Final',
              createdAt: new Date(),
              updatedAt: new Date()
            });

            // Logs eliminados
          }
        }
      }
    }
  }

  /**
   * Crea playoffs para División 3: 2 grupos, 2º y 3º de cada grupo → semifinales y final
   */
  private async createDivision3Playoffs(
    leaguePlayoffTeams: any[],
    matchups: PlayoffMatchup[],
    startDate: Date,
    seasonId: number
  ): Promise<void> {
    // Verificar que hay 2 equipos por liga (2º y 3º)
    if (leaguePlayoffTeams[0].teams.length === 2 && leaguePlayoffTeams[1].teams.length === 2) {
      // Semifinal 1: 2ºA vs 3ºB (mejor clasificado juega en casa)
      matchups.push({
        round: 'Semifinal',
        homeTeamId: leaguePlayoffTeams[0].teams[0].teamId, // 2ºA (mejor clasificado - local)
        homeTeamName: leaguePlayoffTeams[0].teams[0].teamName,
        awayTeamId: leaguePlayoffTeams[1].teams[1].teamId, // 3ºB (peor clasificado - visitante)
        awayTeamName: leaguePlayoffTeams[1].teams[1].teamName,
        scheduledDate: new Date(startDate),
        matchday: 1,
        leagueId: leaguePlayoffTeams[0].leagueId,
        seasonId: seasonId,
        isPlayoff: true
      });
      
      // Semifinal 2: 2ºB vs 3ºA (mejor clasificado - local)
      matchups.push({
        round: 'Semifinal',
        homeTeamId: leaguePlayoffTeams[1].teams[0].teamId, // 2ºB (mejor clasificado - local)
        homeTeamName: leaguePlayoffTeams[1].teams[0].teamName,
        awayTeamId: leaguePlayoffTeams[0].teams[1].teamId, // 3ºA (peor clasificado - visitante)
        awayTeamName: leaguePlayoffTeams[0].teams[1].teamName,
        scheduledDate: new Date(startDate),
        matchday: 1,
        leagueId: leaguePlayoffTeams[1].leagueId,
        seasonId: seasonId,
        isPlayoff: true
      });
      
      // Logs eliminados
      
      // NOTA: La final se creará automáticamente cuando se simulen las semifinales
    }
  }
  
  /**
   * Crea playoffs para División 4: 4 grupos, 2º de cada grupo → semifinales y final
   */
  private async createDivision4Playoffs(
    leaguePlayoffTeams: any[],
    matchups: PlayoffMatchup[],
    startDate: Date,
    seasonId: number
  ): Promise<void> {
    // Verificar que hay 4 grupos con 1 equipo cada uno (2º de cada grupo)
    if (leaguePlayoffTeams.length === 4 && leaguePlayoffTeams.every(lpt => lpt.teams.length === 1)) {
      const allTeams = leaguePlayoffTeams.map(lpt => ({
        teamId: lpt.teams[0].teamId,
        teamName: lpt.teams[0].teamName,
        groupCode: lpt.groupCode
      }));

      // Semifinales cruzadas: Grupo A vs Grupo D, Grupo B vs Grupo C
      const grupoA = allTeams.find(t => t.groupCode === 'A');
      const grupoB = allTeams.find(t => t.groupCode === 'B');
      const grupoC = allTeams.find(t => t.groupCode === 'C');
      const grupoD = allTeams.find(t => t.groupCode === 'D');

      if (grupoA && grupoB && grupoC && grupoD) {
        // Semifinal 1: 2º A vs 2º D
        matchups.push({
          round: 'Semifinal',
          homeTeamId: grupoA.teamId,
          homeTeamName: grupoA.teamName,
          awayTeamId: grupoD.teamId,
          awayTeamName: grupoD.teamName,
          scheduledDate: new Date(startDate),
          matchday: 1,
          leagueId: leaguePlayoffTeams[0].leagueId, // Usar la primera liga como referencia
          seasonId: seasonId,
          isPlayoff: true
        });

        // Semifinal 2: 2º B vs 2º C
        matchups.push({
          round: 'Semifinal',
          homeTeamId: grupoB.teamId,
          homeTeamName: grupoB.teamName,
          awayTeamId: grupoC.teamId,
          awayTeamName: grupoC.teamName,
          scheduledDate: new Date(startDate),
          matchday: 1,
          leagueId: leaguePlayoffTeams[0].leagueId,
          seasonId: seasonId,
          isPlayoff: true
        });

        // Logs eliminados
      } else {
        this.logger.warn('No se encontraron todos los grupos necesarios para División 4');
      }
    } else {
      this.logger.warn(`División 4 requiere 4 grupos con 1 equipo cada uno. Encontrado: ${leaguePlayoffTeams.length} grupos`);
    }
  }
  
  /**
   * Crea playoffs para División 5: 8 grupos, 2º de cada grupo → cuartos, semis y final
   */
  private async createDivision5Playoffs(
    leaguePlayoffTeams: any[],
    matchups: PlayoffMatchup[],
    startDate: Date,
    seasonId: number
  ): Promise<void> {
    // Verificar que hay 8 grupos con 1 equipo cada uno (2º de cada grupo)
    if (leaguePlayoffTeams.length === 8 && leaguePlayoffTeams.every(lpt => lpt.teams.length === 1)) {
      const allTeams = leaguePlayoffTeams.map(lpt => ({
        teamId: lpt.teams[0].teamId,
        teamName: lpt.teams[0].teamName,
        groupCode: lpt.groupCode
      })).sort((a, b) => a.groupCode.localeCompare(b.groupCode)); // Ordenar por grupo

      // Cuartos de final cruzados: A vs H, B vs G, C vs F, D vs E
      const emparejamientos = [
        { home: 'A', away: 'H' },
        { home: 'B', away: 'G' },
        { home: 'C', away: 'F' },
        { home: 'D', away: 'E' }
      ];

      for (let i = 0; i < emparejamientos.length; i++) {
        const emp = emparejamientos[i];
        const equipoHome = allTeams.find(t => t.groupCode === emp.home);
        const equipoAway = allTeams.find(t => t.groupCode === emp.away);

        if (equipoHome && equipoAway) {
          matchups.push({
            round: 'Cuartos',
            homeTeamId: equipoHome.teamId,
            homeTeamName: equipoHome.teamName,
            awayTeamId: equipoAway.teamId,
            awayTeamName: equipoAway.teamName,
            scheduledDate: new Date(startDate),
            matchday: 1,
            leagueId: leaguePlayoffTeams[0].leagueId, // Usar la primera liga como referencia
            seasonId: seasonId,
            isPlayoff: true
          });
        }
      }

      // Logs eliminados
    } else {
      this.logger.warn(`División 5 requiere 8 grupos con 1 equipo cada uno. Encontrado: ${leaguePlayoffTeams.length} grupos`);
    }
  }

  /**
   * Procesa automáticamente los ganadores de finales de playoff y los marca para ascenso
   */
  async processPlayoffWinnersForPromotion(seasonId: number): Promise<void> {
    const db = this.databaseService.db;
    try {
      // Obtener todas las divisiones que tienen playoffs
      const divisions = await db
        .select()
        .from(divisionTable)
        .where(sql`${divisionTable.promotePlayoffSlots} > 0`)
        .orderBy(asc(divisionTable.level));

      for (const division of divisions) {
        // Verificar si los playoffs de esta división están completos
        const playoffsComplete = await this.areDivisionPlayoffsComplete(division.id, seasonId);
        if (!playoffsComplete) continue;

        const leagues = await db
          .select({ id: leagueTable.id })
          .from(leagueTable)
          .where(eq(leagueTable.divisionId, division.id));
        if (leagues.length === 0) continue;
        const leagueIds = leagues.map(l => l.id);

        // División 4: marcar promotedNextSeason=true a los dos finalistas
        if (Number(division.level) === 4) {
          // Buscar partidos de final terminados
          const finals = await db
            .select({
              homeTeamId: matchTable.homeTeamId,
              awayTeamId: matchTable.awayTeamId,
              homeGoals: matchTable.homeGoals,
              awayGoals: matchTable.awayGoals
            })
            .from(matchTable)
            .where(
              and(
                eq(matchTable.seasonId, seasonId),
                inArray(matchTable.leagueId, leagueIds),
                eq(matchTable.isPlayoff, true),
                eq(matchTable.playoffRound, 'Final'),
                eq(matchTable.status, MatchStatus.FINISHED)
              )
            );
          for (const final of finals) {
            // Marcar promotedNextSeason=true a ambos finalistas
            await db.update(teamLeagueAssignmentTable)
              .set({ promotedNextSeason: true, updatedAt: new Date() })
              .where(
                and(
                  eq(teamLeagueAssignmentTable.seasonId, seasonId),
                  inArray(teamLeagueAssignmentTable.teamId, [final.homeTeamId, final.awayTeamId]),
                  inArray(teamLeagueAssignmentTable.leagueId, leagueIds)
                )
              );
          }
        }
        // División 5: marcar promotedNextSeason=true a los 4 semifinalistas
        else if (Number(division.level) === 5) {
          // Buscar partidos de semifinal terminados
          const semis = await db
            .select({
              homeTeamId: matchTable.homeTeamId,
              awayTeamId: matchTable.awayTeamId,
              homeGoals: matchTable.homeGoals,
              awayGoals: matchTable.awayGoals
            })
            .from(matchTable)
            .where(
              and(
                eq(matchTable.seasonId, seasonId),
                inArray(matchTable.leagueId, leagueIds),
                eq(matchTable.isPlayoff, true),
                eq(matchTable.playoffRound, 'Semifinal'),
                eq(matchTable.status, MatchStatus.FINISHED)
              )
            );
          // Ganadores de cada semifinal
          const semifinalistas: number[] = [];
          for (const semi of semis) {
            if (semi.homeGoals !== null && semi.awayGoals !== null) {
              const homeWon = semi.homeGoals > semi.awayGoals;
              semifinalistas.push(homeWon ? semi.homeTeamId : semi.awayTeamId);
              // También el perdedor es semifinalista (en división 5 ascienden los 4)
              semifinalistas.push(homeWon ? semi.awayTeamId : semi.homeTeamId);
            }
          }
          // Marcar promotedNextSeason=true a los 4 equipos
          if (semifinalistas.length === 4) {
            await db.update(teamLeagueAssignmentTable)
              .set({ promotedNextSeason: true, updatedAt: new Date() })
              .where(
                and(
                  eq(teamLeagueAssignmentTable.seasonId, seasonId),
                  inArray(teamLeagueAssignmentTable.teamId, semifinalistas),
                  inArray(teamLeagueAssignmentTable.leagueId, leagueIds)
                )
              );
          }
        }
        // Otras divisiones: solo el ganador de la final asciende
        else {
          const finals = await db
            .select({
              homeTeamId: matchTable.homeTeamId,
              awayTeamId: matchTable.awayTeamId,
              homeGoals: matchTable.homeGoals,
              awayGoals: matchTable.awayGoals
            })
            .from(matchTable)
            .where(
              and(
                eq(matchTable.seasonId, seasonId),
                inArray(matchTable.leagueId, leagueIds),
                eq(matchTable.isPlayoff, true),
                eq(matchTable.playoffRound, 'Final'),
                eq(matchTable.status, MatchStatus.FINISHED)
              )
            );
          for (const final of finals) {
            if (final.homeGoals !== null && final.awayGoals !== null) {
              const homeWon = final.homeGoals > final.awayGoals;
              const winnerId = homeWon ? final.homeTeamId : final.awayTeamId;
              await db.update(teamLeagueAssignmentTable)
                .set({ promotedNextSeason: true, updatedAt: new Date() })
                .where(
                  and(
                    eq(teamLeagueAssignmentTable.seasonId, seasonId),
                    eq(teamLeagueAssignmentTable.teamId, winnerId),
                    inArray(teamLeagueAssignmentTable.leagueId, leagueIds)
                  )
                );
            }
          }
        }
      }
      // Asignar los slots de descenso tras playoffs
      await this.assignRelegatedTeamsToVacantSlots(seasonId);
    } catch (error) {
      this.logger.error('Error procesando ganadores de playoffs:', error);
    }
  }
  /**
   * Marca automáticamente a los equipos según su posición final en liga regular
   * Se ejecuta cuando se completa la temporada regular, antes de playoffs
   * Ahora usa la lógica unificada del StandingsService
   */
  async markTeamsBasedOnRegularSeasonPosition(divisionId: number, seasonId: number): Promise<void> {
    const db = this.databaseService.db;

    try {
      // Obtener información de la división
      const [division] = await db
        .select()
        .from(divisionTable)
        .where(eq(divisionTable.id, divisionId));

      if (!division) {
        this.logger.warn(`División ${divisionId} no encontrada`);
        return;
      }

      // Si la división tiene playoffs configurados, comprobar si hay partidos de playoff jugados o pendientes
      if (division.promotePlayoffSlots && division.promotePlayoffSlots > 0) {
        // Buscar si existen partidos de playoff para esta división y temporada
        const leagues = await db
          .select({ id: leagueTable.id })
          .from(leagueTable)
          .where(eq(leagueTable.divisionId, divisionId));
        const leagueIds = leagues.map(l => l.id);
        if (leagueIds.length > 0) {
          const [playoffCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(matchTable)
            .where(
              and(
                eq(matchTable.seasonId, seasonId),
                inArray(matchTable.leagueId, leagueIds),
                eq(matchTable.isPlayoff, true)
              )
            );
          if (Number(playoffCount.count) > 0) {
            this.logger.warn(`[PROTECCIÓN] No se ejecuta markTeamsBasedOnRegularSeasonPosition en División ${divisionId} porque ya existen partidos de playoff en la temporada actual.`);
            return;
          }
        }
      }

      // Obtener todas las ligas de esta división
      const leagues = await db
        .select()
        .from(leagueTable)
        .where(eq(leagueTable.divisionId, divisionId));

      let totalConsequences = {
        directPromotions: 0,
        directRelegations: 0,
        playoffTeams: 0,
        tournamentQualifiers: 0
      };

      for (const league of leagues) {
        // Usar la nueva función unificada que calcula y aplica consecuencias automáticamente
        const result = await this.standingsService.calculateStandingsWithConsequences(
          seasonId, 
          league.id, 
          true, // Aplicar consecuencias automáticamente
          true  // Limpiar promotedNextSeason SOLO tras liga regular
        );

        if (result.standings.length === 0) {
          this.logger.warn(`No hay clasificación disponible para la liga ${league.name}`);
          continue;
        }

        // Sumar estadísticas globales
        totalConsequences.directPromotions += result.consequences.directPromotions;
        totalConsequences.directRelegations += result.consequences.directRelegations;
        totalConsequences.playoffTeams += result.consequences.playoffTeams;
        totalConsequences.tournamentQualifiers += result.consequences.tournamentQualifiers;
      }
    } catch (error) {
      this.logger.error(`❌ Error marcando equipos por posición final en División ${divisionId}:`, error);
    }
  }

  /**
   * Actualiza el estado de los equipos después de un partido de playoff
   * 
   * Reglas por división:
   * - División 4: Los ganadores de semifinales (finalistas) ascienden. En la final solo se actualiza playoffNextSeason.
   * - División 5: Los ganadores de cuartos (semifinalistas) ascienden. En semifinal/final solo se actualiza playoffNextSeason.
   * - Otras divisiones: Solo el ganador de la final asciende.
   * 
   * En todas las demás rondas, solo el perdedor es eliminado (queda seguro)
   */
  async updateTeamStatusAfterPlayoffMatch(matchId: number): Promise<void> {
    const db = this.databaseService.db;
    try {
      // Log eliminado
      // Obtener información del partido completado
      const [match] = await db
        .select({
          id: matchTable.id,
          seasonId: matchTable.seasonId,
          leagueId: matchTable.leagueId,
          homeTeamId: matchTable.homeTeamId,
          awayTeamId: matchTable.awayTeamId,
          homeGoals: matchTable.homeGoals,
          awayGoals: matchTable.awayGoals,
          playoffRound: matchTable.playoffRound,
          isPlayoff: matchTable.isPlayoff,
          status: matchTable.status,
          divisionName: divisionTable.name,
          divisionLevel: divisionTable.level
        })
        .from(matchTable)
        .innerJoin(leagueTable, eq(matchTable.leagueId, leagueTable.id))
        .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
        .where(eq(matchTable.id, matchId));

      if (!match || !match.isPlayoff || match.status !== MatchStatus.FINISHED) {
        // Log eliminado
        return; // No es un partido de playoff completado
      }
      if (match.homeGoals === null || match.awayGoals === null) {
        return; // No tiene resultado definido
      }
      // Determinar ganador y perdedor
      let winnerId: number;
      let loserId: number;
      if (match.homeGoals > match.awayGoals) {
        winnerId = match.homeTeamId;
        loserId = match.awayTeamId;
      } else {
        winnerId = match.awayTeamId;
        loserId = match.homeTeamId;
      }
      // Obtener nombres de equipos para logging
      const [homeTeam, awayTeam] = await Promise.all([
        db.select({ name: teamTable.name }).from(teamTable).where(eq(teamTable.id, match.homeTeamId)),
        db.select({ name: teamTable.name }).from(teamTable).where(eq(teamTable.id, match.awayTeamId))
      ]);
      const winnerName = winnerId === match.homeTeamId ? homeTeam[0]?.name : awayTeam[0]?.name;
      const loserName = loserId === match.homeTeamId ? homeTeam[0]?.name : awayTeam[0]?.name;
      const winnerIdStr = winnerId != null ? `(#${winnerId})` : '';
      const loserIdStr = loserId != null ? `(#${loserId})` : '';

      // --- Lógica especial para División 4 y 5 ---
      if (match.divisionName === 'División 4') {
        if (match.playoffRound === 'Semifinal') {
          // Ganador de semifinal asciende (finalista)
          const result1 = await db.update(teamLeagueAssignmentTable)
            .set({ promotedNextSeason: true, updatedAt: new Date() })
            .where(and(eq(teamLeagueAssignmentTable.teamId, winnerId), eq(teamLeagueAssignmentTable.seasonId, match.seasonId)));
          if (result1.rowCount === 0) {
            this.logger.warn(`⚠️ [DB] promotedNextSeason: true NO actualizado para equipo ${winnerName} (ID: ${winnerId}) tras ganar semifinal de ${match.divisionName}`);
          } else {
            this.logger.log(`🎉 promotedNextSeason: true para equipo ${winnerName} (ID: ${winnerId}) tras ganar semifinal de ${match.divisionName}`);
          }
          // El perdedor eliminado de playoff, pero NO tocar promotedNextSeason ni playoffNextSeason salvo eliminación
          const result2 = await db.update(teamLeagueAssignmentTable)
            .set({ playoffNextSeason: false, updatedAt: new Date() })
            .where(and(eq(teamLeagueAssignmentTable.teamId, loserId), eq(teamLeagueAssignmentTable.seasonId, match.seasonId)));
          if (result2.rowCount === 0) {
            this.logger.warn(`⚠️ [DB] playoffNextSeason: false NO actualizado para equipo ${loserName} (ID: ${loserId}) en semifinal de ${match.divisionName}`);
          } else {
            this.logger.log(`🛑 ${loserName} ${loserIdStr} eliminado de playoff en semifinal de ${match.divisionName}`);
          }
          // Continuar para comprobar si quedan playoffs pendientes
        }
        if (match.playoffRound === 'Final') {
          // Ambos finalistas ya deberían estar ascendidos, solo actualizar playoffNextSeason si corresponde (no reset masivo)
          const [result1, result2] = await Promise.all([
            db.update(teamLeagueAssignmentTable)
              .set({ playoffNextSeason: false, updatedAt: new Date() })
              .where(and(eq(teamLeagueAssignmentTable.teamId, winnerId), eq(teamLeagueAssignmentTable.seasonId, match.seasonId))),
            db.update(teamLeagueAssignmentTable)
              .set({ playoffNextSeason: false, updatedAt: new Date() })
              .where(and(eq(teamLeagueAssignmentTable.teamId, loserId), eq(teamLeagueAssignmentTable.seasonId, match.seasonId)))
          ]);
          if (result1.rowCount === 0 || result2.rowCount === 0) {
            this.logger.warn(`⚠️ [DB] playoffNextSeason: false NO actualizado para uno o ambos equipos en final de ${match.divisionName}`);
          } else {
            this.logger.log(`🛑 ${winnerName} ${winnerIdStr} (ganador) y ${loserName} ${loserIdStr} (perdedor) finalizan playoff en final de ${match.divisionName}`);
          }

          // LOG DE CONTROL: comprobar flags finales de ambos equipos
          const [winnerStatus, loserStatus] = await Promise.all([
            db.select({ promotedNextSeason: teamLeagueAssignmentTable.promotedNextSeason, playoffNextSeason: teamLeagueAssignmentTable.playoffNextSeason })
              .from(teamLeagueAssignmentTable)
              .where(and(eq(teamLeagueAssignmentTable.teamId, winnerId), eq(teamLeagueAssignmentTable.seasonId, match.seasonId))),
            db.select({ promotedNextSeason: teamLeagueAssignmentTable.promotedNextSeason, playoffNextSeason: teamLeagueAssignmentTable.playoffNextSeason })
              .from(teamLeagueAssignmentTable)
              .where(and(eq(teamLeagueAssignmentTable.teamId, loserId), eq(teamLeagueAssignmentTable.seasonId, match.seasonId)))
          ]);
          const winnerPromoted = winnerStatus[0]?.promotedNextSeason;
          const winnerPlayoff = winnerStatus[0]?.playoffNextSeason;
          const loserPromoted = loserStatus[0]?.promotedNextSeason;
          const loserPlayoff = loserStatus[0]?.playoffNextSeason;
          this.logger.log(`[CONTROL] Estado final tras final División 4: ${winnerName} (ID: ${winnerId}) => promotedNextSeason: ${winnerPromoted}, playoffNextSeason: ${winnerPlayoff} | ${loserName} (ID: ${loserId}) => promotedNextSeason: ${loserPromoted}, playoffNextSeason: ${loserPlayoff}`);
          if (!winnerPromoted) {
            this.logger.warn(`[CONTROL] ⚠️ El ganador de la final de División 4 (${winnerName}, ID: ${winnerId}) NO está marcado como promotedNextSeason: true tras la final.`);
          }
          if (!loserPromoted) {
            this.logger.warn(`[CONTROL] ⚠️ El perdedor de la final de División 4 (${loserName}, ID: ${loserId}) NO está marcado como promotedNextSeason: true tras la final (debería estarlo, ambos finalistas ascienden).`);
          }
          // Continuar para comprobar si quedan playoffs pendientes
        }
      }
      if (match.divisionName === 'División 5') {
        if (match.playoffRound === 'Cuartos') {
          // Ganador de cuartos asciende (semifinalista)
          const result1 = await db.update(teamLeagueAssignmentTable)
            .set({ promotedNextSeason: true, updatedAt: new Date() })
            .where(and(eq(teamLeagueAssignmentTable.teamId, winnerId), eq(teamLeagueAssignmentTable.seasonId, match.seasonId)));
          if (result1.rowCount === 0) {
            this.logger.warn(`⚠️ [DB] promotedNextSeason: true NO actualizado para equipo ${winnerName} (ID: ${winnerId}) tras ganar cuartos de ${match.divisionName}`);
          } else {
            this.logger.log(`🎉 promotedNextSeason: true para equipo ${winnerName} (ID: ${winnerId}) tras ganar cuartos de ${match.divisionName}`);
          }
          // El perdedor eliminado de playoff, pero NO tocar promotedNextSeason
          const result2 = await db.update(teamLeagueAssignmentTable)
            .set({ playoffNextSeason: false, updatedAt: new Date() })
            .where(and(eq(teamLeagueAssignmentTable.teamId, loserId), eq(teamLeagueAssignmentTable.seasonId, match.seasonId)));
          if (result2.rowCount === 0) {
            this.logger.warn(`⚠️ [DB] playoffNextSeason: false NO actualizado para equipo ${loserName} (ID: ${loserId}) en cuartos de ${match.divisionName}`);
          } else {
            this.logger.log(`🛑 ${loserName} ${loserIdStr} eliminado de playoff en cuartos de ${match.divisionName}`);
          }
          // Continuar para comprobar si quedan playoffs pendientes
        }
        if (match.playoffRound === 'Semifinal' || match.playoffRound === 'Final') {
          // Ambos semifinalistas ya deberían estar ascendidos, solo actualizar playoffNextSeason
          const result = await db.update(teamLeagueAssignmentTable)
            .set({ playoffNextSeason: false, updatedAt: new Date() })
            .where(and(eq(teamLeagueAssignmentTable.teamId, loserId), eq(teamLeagueAssignmentTable.seasonId, match.seasonId)));
          if (result.rowCount === 0) {
            this.logger.warn(`⚠️ [DB] playoffNextSeason: false NO actualizado para equipo ${loserName} (ID: ${loserId}) en ${match.playoffRound} de ${match.divisionName}`);
          } else {
            this.logger.log(`🛑 ${loserName} ${loserIdStr} eliminado de playoff en ${match.playoffRound} de ${match.divisionName}`);
          }
          // Continuar para comprobar si quedan playoffs pendientes
        }
      }
      // --- Lógica general para otras divisiones ---
      if (match.playoffRound === 'Final') {
        // Solo el ganador asciende
        const result1 = await db.update(teamLeagueAssignmentTable)
          .set({ promotedNextSeason: true, playoffNextSeason: false, updatedAt: new Date() })
          .where(and(eq(teamLeagueAssignmentTable.teamId, winnerId), eq(teamLeagueAssignmentTable.seasonId, match.seasonId)));
        if (result1.rowCount === 0) {
          this.logger.warn(`⚠️ [DB] promotedNextSeason: true NO actualizado para equipo ${winnerName} (ID: ${winnerId}) tras ganar final de ${match.divisionName}`);
        } else {
          this.logger.log(`🎉 promotedNextSeason: true para equipo ${winnerName} (ID: ${winnerId}) tras ganar final de ${match.divisionName}`);
        }
        const result2 = await db.update(teamLeagueAssignmentTable)
          .set({ playoffNextSeason: false, updatedAt: new Date() })
          .where(and(eq(teamLeagueAssignmentTable.teamId, loserId), eq(teamLeagueAssignmentTable.seasonId, match.seasonId)));
        if (result2.rowCount === 0) {
          this.logger.warn(`⚠️ [DB] playoffNextSeason: false NO actualizado para equipo ${loserName} (ID: ${loserId}) en final de ${match.divisionName}`);
        } else {
          this.logger.log(`🎉 ${winnerName} ${winnerIdStr} (ganador) marcado para ascenso y 🛑 ${loserName} ${loserIdStr} (perdedor) eliminado de playoff en final de ${match.divisionName}`);
        }
        // Continuar para comprobar si quedan playoffs pendientes
      }
      // Otras rondas: solo eliminar perdedor de playoff, nunca quitar ascenso
      const result = await db.update(teamLeagueAssignmentTable)
        .set({ playoffNextSeason: false, updatedAt: new Date() })
        .where(and(eq(teamLeagueAssignmentTable.teamId, loserId), eq(teamLeagueAssignmentTable.seasonId, match.seasonId)));
      if (result.rowCount === 0) {
        this.logger.warn(`⚠️ [DB] playoffNextSeason: false NO actualizado para equipo ${loserName} (ID: ${loserId}) en ${match.playoffRound} de ${match.divisionName}`);
      } else {
        this.logger.log(`🛑 ${loserName} ${loserIdStr} eliminado de playoff en ${match.playoffRound} de ${match.divisionName}`);
      }

      // --- NUEVO: Si ya no quedan partidos de playoff pendientes en la división, ejecutar processPlayoffWinnersForPromotion ---
      const playoffsPendientes = await db
        .select({ count: sql<number>`count(*)` })
        .from(matchTable)
        .innerJoin(leagueTable, eq(matchTable.leagueId, leagueTable.id))
        .where(
          and(
            eq(matchTable.seasonId, match.seasonId),
            eq(leagueTable.divisionId, match.divisionLevel ? match.divisionLevel : 0),
            eq(matchTable.isPlayoff, true),
            eq(matchTable.status, MatchStatus.SCHEDULED)
          )
        );
      if (Number(playoffsPendientes[0]?.count) === 0) {
        this.logger.log(`[AUTO] Playoffs completados en División ${match.divisionName} (ID: ${match.divisionLevel}). Ejecutando processPlayoffWinnersForPromotion...`);
        await this.processPlayoffWinnersForPromotion(match.seasonId);
      }
    } catch (error) {
      this.logger.error(`❌ Error actualizando estados tras partido de playoff ${matchId}:`, error);
    }
  }

  /**
   * Método de debug para verificar estados de equipos en una temporada específica
   */
  async debugTeamStatusInSeason(seasonId: number, divisionName?: string): Promise<void> {
    const db = this.databaseService.db;
    
    try {
      // Logs eliminados
      let whereConditions = [eq(teamLeagueAssignmentTable.seasonId, seasonId)];
      if (divisionName) {
        whereConditions.push(eq(divisionTable.name, divisionName));
      }
      const teamStatuses = await db
        .select({
          teamName: teamTable.name,
          divisionName: divisionTable.name,
          playoffNextSeason: teamLeagueAssignmentTable.playoffNextSeason,
          promotedNextSeason: teamLeagueAssignmentTable.promotedNextSeason,
          relegatedNextSeason: teamLeagueAssignmentTable.relegatedNextSeason,
          qualifiedForTournament: teamLeagueAssignmentTable.qualifiedForTournament
        })
        .from(teamLeagueAssignmentTable)
        .innerJoin(teamTable, eq(teamLeagueAssignmentTable.teamId, teamTable.id))
        .innerJoin(leagueTable, eq(teamLeagueAssignmentTable.leagueId, leagueTable.id))
        .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
        .where(and(...whereConditions));
      // Logs eliminados
    } catch (error) {
      this.logger.error(`❌ Error en debug de estados de equipos:`, error);
    }
  }

  /**
   * Asigna automáticamente las ligas de destino para la próxima temporada
   * Maneja ascensos, descensos y distribución entre grupos
   */
  async assignLeaguesForNextSeason(seasonId: number): Promise<{
    message: string;
    promotions: number;
    relegations: number;
    stays: number;
    errors: string[];
  }> {
    const db = this.databaseService.db;
    const errors: string[] = [];
    let promotions = 0;
    let relegations = 0;
    let stays = 0;

    try {
      // ...existing code...

      // Procesar divisiones en orden descendente (5 -> 4 -> 3 -> 2 -> 1)
      for (let divisionLevel = 5; divisionLevel >= 1; divisionLevel--) {
        try {
          const result = await this.assignLeaguesForDivision(seasonId, divisionLevel);
          promotions += result.promotions;
          relegations += result.relegations;
          stays += result.stays;
          
          if (result.errors.length > 0) {
            errors.push(...result.errors);
          }
        } catch (error) {
          const errorMsg = `Error procesando División ${divisionLevel}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      // ...existing code...

      return {
        message: 'Asignación automática de ligas completada',
        promotions,
        relegations,
        stays,
        errors
      };

    } catch (error) {
      this.logger.error('❌ Error en asignación automática de ligas:', error);
      throw error;
    }
  }

  /**
   * Asigna ligas para una división específica
   */
  private async assignLeaguesForDivision(seasonId: number, divisionLevel: number): Promise<{
    promotions: number;
    relegations: number;
    stays: number;
    errors: string[];
  }> {
    const db = this.databaseService.db;
    const errors: string[] = [];
    let promotions = 0;
    let relegations = 0;
    let stays = 0;

    // Obtener división actual
    const [currentDivision] = await db
      .select()
      .from(divisionTable)
      .where(eq(divisionTable.level, divisionLevel));

    if (!currentDivision) {
      throw new Error(`División ${divisionLevel} no encontrada`);
    }

    // Obtener división superior (para ascensos)
    const [upperDivision] = await db
      .select()
      .from(divisionTable)
      .where(eq(divisionTable.level, divisionLevel - 1));

    // Obtener división inferior (para descensos)
    const [lowerDivision] = await db
      .select()
      .from(divisionTable)
      .where(eq(divisionTable.level, divisionLevel + 1));

    // Obtener ligas de la división actual
    const currentLeagues = await db
      .select()
      .from(leagueTable)
      .where(eq(leagueTable.divisionId, currentDivision.id))
      .orderBy(asc(leagueTable.groupCode));

    // Obtener ligas de división superior (si existe)
    const upperLeagues = upperDivision ? await db
      .select()
      .from(leagueTable)
      .where(eq(leagueTable.divisionId, upperDivision.id))
      .orderBy(asc(leagueTable.groupCode)) : [];

    // Obtener ligas de división inferior (si existe)
    const lowerLeagues = lowerDivision ? await db
      .select()
      .from(leagueTable)
      .where(eq(leagueTable.divisionId, lowerDivision.id))
      .orderBy(asc(leagueTable.groupCode)) : [];

    // Procesar según el nivel de división
    switch (divisionLevel) {
      case 1:
        ({ promotions, relegations, stays } = await this.assignDivision1Teams(
          seasonId, currentLeagues, lowerLeagues
        ));
        break;
      case 2:
        ({ promotions, relegations, stays } = await this.assignDivision2Teams(
          seasonId, currentLeagues, upperLeagues, lowerLeagues
        ));
        break;
      case 3:
        ({ promotions, relegations, stays } = await this.assignDivision3Teams(
          seasonId, currentLeagues, upperLeagues, lowerLeagues
        ));
        break;
      case 4:
        ({ promotions, relegations, stays } = await this.assignDivision4Teams(
          seasonId, currentLeagues, upperLeagues, lowerLeagues
        ));
        break;
      case 5:
        ({ promotions, relegations, stays } = await this.assignDivision5Teams(
          seasonId, currentLeagues, upperLeagues
        ));
        break;
      default:
        throw new Error(`División ${divisionLevel} no soportada`);
    }

    // Log eliminado: resumen división

    return { promotions, relegations, stays, errors };
  }

  /**
   * Asigna equipos de División 1 (solo descensos)
   */
  private async assignDivision1Teams(
    seasonId: number,
    currentLeagues: any[],
    lowerLeagues: any[]
  ): Promise<{ promotions: number; relegations: number; stays: number }> {
    const db = this.databaseService.db;
    let promotions = 0;
    let relegations = 0;
    let stays = 0;

    // División 1: solo descensos (3 últimos van a División 2)
    const leagueId = currentLeagues[0].id;
    
    // Obtener equipos relegados
    const relegatedTeams = await db
      .select({
        teamId: teamLeagueAssignmentTable.teamId
      })
      .from(teamLeagueAssignmentTable)
      .where(
        and(
          eq(teamLeagueAssignmentTable.seasonId, seasonId),
          eq(teamLeagueAssignmentTable.leagueId, leagueId),
          eq(teamLeagueAssignmentTable.relegatedNextSeason, true)
        )
      );

    // Asignar equipos relegados a División 2 (hay una sola liga)
    for (const team of relegatedTeams) {
      await db
        .update(teamLeagueAssignmentTable)
        .set({ leagueNextSeason: lowerLeagues[0].id })
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.teamId, team.teamId)
          )
        );
      relegations++;
    }

    // Todos los demás se quedan en División 1
    const allTeams = await db
      .select({
        teamId: teamLeagueAssignmentTable.teamId
      })
      .from(teamLeagueAssignmentTable)
      .where(
        and(
          eq(teamLeagueAssignmentTable.seasonId, seasonId),
          eq(teamLeagueAssignmentTable.leagueId, leagueId),
          eq(teamLeagueAssignmentTable.relegatedNextSeason, false)
        )
      );

    for (const team of allTeams) {
      await db
        .update(teamLeagueAssignmentTable)
        .set({ leagueNextSeason: leagueId })
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.teamId, team.teamId)
          )
        );
      stays++;
    }

    return { promotions, relegations, stays };
  }

  /**
   * Asigna equipos de División 2 (ascensos a División 1, descensos a División 3)
   */
  private async assignDivision2Teams(
    seasonId: number,
    currentLeagues: any[],
    upperLeagues: any[],
    lowerLeagues: any[]
  ): Promise<{ promotions: number; relegations: number; stays: number }> {
    const db = this.databaseService.db;
    let promotions = 0;
    let relegations = 0;
    let stays = 0;

    const leagueId = currentLeagues[0].id;

    // Ascensos a División 1
    const promotedTeams = await db
      .select({
        teamId: teamLeagueAssignmentTable.teamId
      })
      .from(teamLeagueAssignmentTable)
      .where(
        and(
          eq(teamLeagueAssignmentTable.seasonId, seasonId),
          eq(teamLeagueAssignmentTable.leagueId, leagueId),
          eq(teamLeagueAssignmentTable.promotedNextSeason, true)
        )
      );

    for (const team of promotedTeams) {
      await db
        .update(teamLeagueAssignmentTable)
        .set({ leagueNextSeason: upperLeagues[0].id })
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.teamId, team.teamId)
          )
        );
      promotions++;
    }

    // Descensos a División 3 (distribución aleatoria entre grupos A y B)
    const relegatedTeams = await db
      .select({
        teamId: teamLeagueAssignmentTable.teamId
      })
      .from(teamLeagueAssignmentTable)
      .where(
        and(
          eq(teamLeagueAssignmentTable.seasonId, seasonId),
          eq(teamLeagueAssignmentTable.leagueId, leagueId),
          eq(teamLeagueAssignmentTable.relegatedNextSeason, true)
        )
      );

    // Distribución aleatoria entre grupos de División 3
    for (let i = 0; i < relegatedTeams.length; i++) {
      const targetLeague = lowerLeagues[i % lowerLeagues.length];
      await db
        .update(teamLeagueAssignmentTable)
        .set({ leagueNextSeason: targetLeague.id })
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.teamId, relegatedTeams[i].teamId)
          )
        );
      relegations++;
    }

    // Todos los demás se quedan en División 2
    const stayingTeams = await db
      .select({
        teamId: teamLeagueAssignmentTable.teamId
      })
      .from(teamLeagueAssignmentTable)
      .where(
        and(
          eq(teamLeagueAssignmentTable.seasonId, seasonId),
          eq(teamLeagueAssignmentTable.leagueId, leagueId),
          eq(teamLeagueAssignmentTable.promotedNextSeason, false),
          eq(teamLeagueAssignmentTable.relegatedNextSeason, false)
        )
      );

    for (const team of stayingTeams) {
      await db
        .update(teamLeagueAssignmentTable)
        .set({ leagueNextSeason: leagueId })
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.teamId, team.teamId)
          )
        );
      stays++;
    }

    return { promotions, relegations, stays };
  }

  /**
   * Asigna equipos de División 3 (ascensos a División 2, descensos a División 4)
   */
  private async assignDivision3Teams(
    seasonId: number,
    currentLeagues: any[],
    upperLeagues: any[],
    lowerLeagues: any[]
  ): Promise<{ promotions: number; relegations: number; stays: number }> {
    const db = this.databaseService.db;
    let promotions = 0;
    let relegations = 0;
    let stays = 0;

    // Ascensos a División 2 (3 equipos total)
    const allPromotedTeams: { teamId: number }[] = [];
    for (const league of currentLeagues) {
      const promotedTeams = await db
        .select({
          teamId: teamLeagueAssignmentTable.teamId
        })
        .from(teamLeagueAssignmentTable)
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.leagueId, league.id),
            eq(teamLeagueAssignmentTable.promotedNextSeason, true)
          )
        );
      allPromotedTeams.push(...promotedTeams);
    }

    // Todos van a División 2 (hay una sola liga)
    for (const team of allPromotedTeams) {
      await db
        .update(teamLeagueAssignmentTable)
        .set({ leagueNextSeason: upperLeagues[0].id })
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.teamId, team.teamId)
          )
        );
      promotions++;
    }

    // Descensos a División 4 (distribución entre 4 grupos)
    const allRelegatedTeams: { teamId: number }[] = [];
    for (const league of currentLeagues) {
      const relegatedTeams = await db
        .select({
          teamId: teamLeagueAssignmentTable.teamId
        })
        .from(teamLeagueAssignmentTable)
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.leagueId, league.id),
            eq(teamLeagueAssignmentTable.relegatedNextSeason, true)
          )
        );
      allRelegatedTeams.push(...relegatedTeams);
    }

    // Distribución aleatoria entre grupos de División 4
    for (let i = 0; i < allRelegatedTeams.length; i++) {
      const targetLeague = lowerLeagues[i % lowerLeagues.length];
      await db
        .update(teamLeagueAssignmentTable)
        .set({ leagueNextSeason: targetLeague.id })
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.teamId, allRelegatedTeams[i].teamId)
          )
        );
      relegations++;
    }

    // Todos los demás se quedan en División 3 (mantienen su grupo)
    for (const league of currentLeagues) {
      const stayingTeams = await db
        .select({
          teamId: teamLeagueAssignmentTable.teamId
        })
        .from(teamLeagueAssignmentTable)
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.leagueId, league.id),
            eq(teamLeagueAssignmentTable.promotedNextSeason, false),
            eq(teamLeagueAssignmentTable.relegatedNextSeason, false)
          )
        );

      for (const team of stayingTeams) {
        await db
          .update(teamLeagueAssignmentTable)
          .set({ leagueNextSeason: league.id })
          .where(
            and(
              eq(teamLeagueAssignmentTable.seasonId, seasonId),
              eq(teamLeagueAssignmentTable.teamId, team.teamId)
            )
          );
        stays++;
      }
    }

    return { promotions, relegations, stays };
  }

  /**
   * Asigna equipos de División 4 (ascensos a División 3, descensos a División 5)
   * 6 equipos ascienden: distribución 3 a cada grupo de División 3
   */
  private async assignDivision4Teams(
    seasonId: number,
    currentLeagues: any[],
    upperLeagues: any[],
    lowerLeagues: any[]
  ): Promise<{ promotions: number; relegations: number; stays: number }> {
    const db = this.databaseService.db;
    let promotions = 0;
    let relegations = 0;
    let stays = 0;

    // Ascensos a División 3 (6 equipos total → 3 a cada grupo)
    const allPromotedTeams: { teamId: number }[] = [];
    for (const league of currentLeagues) {
      const promotedTeams = await db
        .select({
          teamId: teamLeagueAssignmentTable.teamId
        })
        .from(teamLeagueAssignmentTable)
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.leagueId, league.id),
            eq(teamLeagueAssignmentTable.promotedNextSeason, true)
          )
        );
      allPromotedTeams.push(...promotedTeams);
    }

    // Distribución: 3 equipos a cada grupo de División 3
    // Algoritmo: alternar entre grupos para balancear
    for (let i = 0; i < allPromotedTeams.length; i++) {
      const targetLeague = upperLeagues[Math.floor(i / 3) % upperLeagues.length];
      await db
        .update(teamLeagueAssignmentTable)
        .set({ leagueNextSeason: targetLeague.id })
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.teamId, allPromotedTeams[i].teamId)
          )
        );
      promotions++;
    }

    // Descensos a División 5 (distribución entre 8 grupos)
    const allRelegatedTeams: { teamId: number }[] = [];
    for (const league of currentLeagues) {
      const relegatedTeams = await db
        .select({
          teamId: teamLeagueAssignmentTable.teamId
        })
        .from(teamLeagueAssignmentTable)
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.leagueId, league.id),
            eq(teamLeagueAssignmentTable.relegatedNextSeason, true)
          )
        );
      allRelegatedTeams.push(...relegatedTeams);
    }

    // Distribución entre grupos de División 5
    for (let i = 0; i < allRelegatedTeams.length; i++) {
      const targetLeague = lowerLeagues[i % lowerLeagues.length];
      await db
        .update(teamLeagueAssignmentTable)
        .set({ leagueNextSeason: targetLeague.id })
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.teamId, allRelegatedTeams[i].teamId)
          )
        );
      relegations++;
    }

    // Todos los demás se quedan en División 4 (mantienen su grupo)
    for (const league of currentLeagues) {
      const stayingTeams = await db
        .select({
          teamId: teamLeagueAssignmentTable.teamId
        })
        .from(teamLeagueAssignmentTable)
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.leagueId, league.id),
            eq(teamLeagueAssignmentTable.promotedNextSeason, false),
            eq(teamLeagueAssignmentTable.relegatedNextSeason, false)
          )
        );

      for (const team of stayingTeams) {
        await db
          .update(teamLeagueAssignmentTable)
          .set({ leagueNextSeason: league.id })
          .where(
            and(
              eq(teamLeagueAssignmentTable.seasonId, seasonId),
              eq(teamLeagueAssignmentTable.teamId, team.teamId)
            )
          );
        stays++;
      }
    }

    return { promotions, relegations, stays };
  }

  /**
   * Asigna equipos de División 5 (solo ascensos a División 4)
   * 12 equipos ascienden: distribución 3 a cada grupo de División 4
   */
  private async assignDivision5Teams(
    seasonId: number,
    currentLeagues: any[],
    upperLeagues: any[]
  ): Promise<{ promotions: number; relegations: number; stays: number }> {
    const db = this.databaseService.db;
    let promotions = 0;
    let relegations = 0;
    let stays = 0;

    // Ascensos a División 4 (12 equipos total → 3 a cada grupo)
    const allPromotedTeams: { teamId: number }[] = [];
    for (const league of currentLeagues) {
      const promotedTeams = await db
        .select({
          teamId: teamLeagueAssignmentTable.teamId
        })
        .from(teamLeagueAssignmentTable)
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.leagueId, league.id),
            eq(teamLeagueAssignmentTable.promotedNextSeason, true)
          )
        );
      allPromotedTeams.push(...promotedTeams);
    }

    // Distribución: 3 equipos a cada grupo de División 4
    for (let i = 0; i < allPromotedTeams.length; i++) {
      const targetLeague = upperLeagues[Math.floor(i / 3) % upperLeagues.length];
      await db
        .update(teamLeagueAssignmentTable)
        .set({ leagueNextSeason: targetLeague.id })
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.teamId, allPromotedTeams[i].teamId)
          )
        );
      promotions++;
    }

    // Todos los demás se quedan en División 5 (mantienen su grupo)
    for (const league of currentLeagues) {
      const stayingTeams = await db
        .select({
          teamId: teamLeagueAssignmentTable.teamId
        })
        .from(teamLeagueAssignmentTable)
        .where(
          and(
            eq(teamLeagueAssignmentTable.seasonId, seasonId),
            eq(teamLeagueAssignmentTable.leagueId, league.id),
            eq(teamLeagueAssignmentTable.promotedNextSeason, false)
          )
        );

      for (const team of stayingTeams) {
        await db
          .update(teamLeagueAssignmentTable)
          .set({ leagueNextSeason: league.id })
          .where(
            and(
              eq(teamLeagueAssignmentTable.seasonId, seasonId),
              eq(teamLeagueAssignmentTable.teamId, team.teamId)
            )
          );
        stays++;
      }
    }

    return { promotions, relegations, stays };
  }
}
