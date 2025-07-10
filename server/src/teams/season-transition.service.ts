import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SeasonTransitionAssignmentService, TeamAssignmentPlan } from './season-transition-assignment.service';
import { 
  divisionTable, 
  leagueTable, 
  seasonTable, 
  teamLeagueAssignmentTable,
  teamTable,
  matchTable,
  standingsTable,
  AssignmentReason,
  MatchStatus
} from '../database/schema';
import { eq, and, or, desc, asc, sql, inArray } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { DATABASE_PROVIDER } from '../database/database.module';

export interface StandingsEntry {
  teamId: number;
  teamName: string;
  position: number;
  leagueId: number;
  leagueName: string;
  divisionLevel: number;
  groupCode: string;
}

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
  ) {}

  /**
   * Procesa el cierre de temporada y prepara la siguiente
   * @param currentSeasonId ID de la temporada que se cierra
   * @param nextSeasonId ID de la nueva temporada (debe estar creada)
   */
  async processSeasonTransition(currentSeasonId: number, nextSeasonId?: number): Promise<SeasonTransitionResult> {
    const db = this.databaseService.db;
    
    this.logger.log(`Iniciando transición de temporada ${currentSeasonId}${nextSeasonId ? ` a ${nextSeasonId}` : ''}`);
    
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
        this.logger.log(`Procesando División ${division.level}: ${division.name}`);
        
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
    let tournamentQualifiers = 0;
    
    // Procesar cada liga de la división
    for (const league of leagues) {
      // Obtener clasificación final de la liga
      const standings = await db
        .select({
          teamId: standingsTable.teamId,
          position: standingsTable.position,
          divisionLevel: divisionTable.level
        })
        .from(standingsTable)
        .innerJoin(teamTable, eq(standingsTable.teamId, teamTable.id))
        .innerJoin(leagueTable, eq(standingsTable.leagueId, leagueTable.id))
        .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
        .where(
          and(
            eq(standingsTable.leagueId, league.id),
            eq(standingsTable.seasonId, currentSeasonId)
          )
        )
        .orderBy(asc(standingsTable.position));
        
      // Verificar si hay clasificación para esta liga
      if (standings.length === 0) {
        this.logger.warn(`No hay clasificación disponible para la liga ${league.name} (ID: ${league.id})`);
        continue;
      }
      
      // Procesar ascensos directos
      if (Number(division.promoteSlots || 0) > 0) {
        const directPromoteTeams = standings.slice(0, Number(division.promoteSlots || 0));
        
        for (const team of directPromoteTeams) {
          // Marcar para ascenso si no es la división más alta
          if (division.level > 1) {
            await this.markTeamForPromotion(team.teamId, currentSeasonId, nextSeasonId);
            directPromotions++;
          }
        }
      }
      
      // Procesar equipos para playoffs de ascenso
      if (Number(division.promotePlayoffSlots || 0) > 0) {
        const startPos = Number(division.promoteSlots || 0);
        const endPos = startPos + Number(division.promotePlayoffSlots || 0);
        const playoffTeamsInLeague = standings.slice(startPos, endPos);
        
        for (const team of playoffTeamsInLeague) {
          if (division.level > 1) {
            await this.markTeamForPlayoff(team.teamId, currentSeasonId, nextSeasonId);
            playoffTeams++;
          }
        }
      }
      
      // Procesar descensos directos
      if (Number(division.relegateSlots || 0) > 0) {
        const relegationStartPos = standings.length - Number(division.relegateSlots || 0);
        const teamsToRelegate = standings.slice(relegationStartPos);
        
        for (const team of teamsToRelegate) {
          // Marcar para descenso si no es la división más baja
          if (division.level < 5) { // Ajustar según la estructura real
            await this.markTeamForRelegation(team.teamId, currentSeasonId, nextSeasonId);
            directRelegations++;
          }
        }
      }
      
      // Procesar clasificación a torneos (solo para División 1)
      if (Number(division.tournamentSlots || 0) > 0 && division.level === 1) {
        const tournamentTeams = standings.slice(0, Number(division.tournamentSlots || 0));
        
        for (const team of tournamentTeams) {
          await this.markTeamForTournament(team.teamId, currentSeasonId);
          tournamentQualifiers++;
        }
      }
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
    return this.organizePlayoffsInternal(divisionId, seasonId);
  }
  
  /**
   * Organiza los playoffs para una división (implementación interna mejorada)
   */
  private async organizePlayoffsInternal(
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
      this.logger.log(`División ${division.name} no tiene playoffs configurados`);
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
    const db = this.databaseService.db;
    
    // Calcular clasificaciones dinámicamente
    const standings = await this.calculateDynamicStandings(leagueId, seasonId);
    
    // Obtener equipos clasificados al playoff
    const startPos = Number(division.promoteSlots || 0) + 1; // +1 porque positions son 1-indexed
    const endPos = startPos + Number(division.promotePlayoffSlots || 0) - 1;
    
    const playoffTeams = standings.filter(team => 
      team.position >= startPos && team.position <= endPos
    );
    
    this.logger.log(`Equipos de playoff para división ${division.name}: posiciones ${startPos}-${endPos}, encontrados: ${playoffTeams.length}`);
    
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
      
      this.logger.log(`✅ Creadas semifinales de playoff para ${division.name}:`);
      this.logger.log(`   🏟️ Semifinal 1: ${playoffTeams[0].teamName} (3º) vs ${playoffTeams[3].teamName} (6º)`);
      this.logger.log(`   🏟️ Semifinal 2: ${playoffTeams[1].teamName} (4º) vs ${playoffTeams[2].teamName} (5º)`);
      this.logger.log(`   📅 Fecha programada: ${startDate.toLocaleDateString()}`);
      
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
      const standings = await this.calculateDynamicStandings(league.id, seasonId);
      
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
      scheduledDate: matchup.scheduledDate.toISOString().split('T')[0],
      status: MatchStatus.SCHEDULED,
      isPlayoff: true,
      playoffRound: matchup.round,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    await db.insert(matchTable).values(matchesToInsert);
  }
  
  /**
   * Marca un equipo para ascenso en la próxima temporada
   */
  private async markTeamForPromotion(
    teamId: number,
    currentSeasonId: number,
    nextSeasonId?: number
  ): Promise<void> {
    const db = this.databaseService.db;
    
    // Obtener la asignación actual
    const [currentAssignment] = await db
      .select({
        teamId: teamLeagueAssignmentTable.teamId,
        leagueId: teamLeagueAssignmentTable.leagueId,
        divisionLevel: divisionTable.level,
        divisionId: divisionTable.id
      })
      .from(teamLeagueAssignmentTable)
      .innerJoin(leagueTable, eq(teamLeagueAssignmentTable.leagueId, leagueTable.id))
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .where(
        and(
          eq(teamLeagueAssignmentTable.teamId, teamId),
          eq(teamLeagueAssignmentTable.seasonId, currentSeasonId)
        )
      );
      
    if (!currentAssignment) {
      this.logger.warn(`No se encontró asignación actual para el equipo ${teamId}`);
      return;
    }
    
    // Obtener la división superior
    const targetDivisionLevel = currentAssignment.divisionLevel - 1;
    
    const [targetDivision] = await db
      .select()
      .from(divisionTable)
      .where(eq(divisionTable.level, targetDivisionLevel));
      
    if (!targetDivision) {
      this.logger.warn(`No se encontró división de nivel ${targetDivisionLevel}`);
      return;
    }
    
    // Obtener una liga disponible en la división superior
    const [targetLeague] = await db
      .select()
      .from(leagueTable)
      .where(eq(leagueTable.divisionId, targetDivision.id))
      .limit(1);
      
    if (!targetLeague) {
      this.logger.warn(`No se encontró liga en la división ${targetDivision.name}`);
      return;
    }
    
    // Si tenemos la próxima temporada, crear la asignación
    if (nextSeasonId) {
      await this.createTeamAssignmentForNextSeason(
        teamId, 
        targetLeague.id, 
        nextSeasonId, 
        AssignmentReason.PROMOTION
      );
    }
    
    // Registrar el ascenso en la temporada actual
    await db
      .update(teamLeagueAssignmentTable)
      .set({
        promotedNextSeason: true,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(teamLeagueAssignmentTable.teamId, teamId),
          eq(teamLeagueAssignmentTable.seasonId, currentSeasonId)
        )
      );
  }
  
  /**
   * Marca un equipo para descenso en la próxima temporada
   */
  private async markTeamForRelegation(
    teamId: number,
    currentSeasonId: number,
    nextSeasonId?: number
  ): Promise<void> {
    const db = this.databaseService.db;
    
    // Obtener la asignación actual
    const [currentAssignment] = await db
      .select({
        teamId: teamLeagueAssignmentTable.teamId,
        leagueId: teamLeagueAssignmentTable.leagueId,
        divisionLevel: divisionTable.level,
        divisionId: divisionTable.id
      })
      .from(teamLeagueAssignmentTable)
      .innerJoin(leagueTable, eq(teamLeagueAssignmentTable.leagueId, leagueTable.id))
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .where(
        and(
          eq(teamLeagueAssignmentTable.teamId, teamId),
          eq(teamLeagueAssignmentTable.seasonId, currentSeasonId)
        )
      );
      
    if (!currentAssignment) {
      this.logger.warn(`No se encontró asignación actual para el equipo ${teamId}`);
      return;
    }
    
    // Obtener la división inferior
    const targetDivisionLevel = currentAssignment.divisionLevel + 1;
    
    const [targetDivision] = await db
      .select()
      .from(divisionTable)
      .where(eq(divisionTable.level, targetDivisionLevel));
      
    if (!targetDivision) {
      this.logger.warn(`No se encontró división de nivel ${targetDivisionLevel}`);
      return;
    }
    
    // Obtener una liga disponible en la división inferior
    const [targetLeague] = await db
      .select()
      .from(leagueTable)
      .where(eq(leagueTable.divisionId, targetDivision.id))
      .limit(1);
      
    if (!targetLeague) {
      this.logger.warn(`No se encontró liga en la división ${targetDivision.name}`);
      return;
    }
    
    // Si tenemos la próxima temporada, crear la asignación
    if (nextSeasonId) {
      await this.createTeamAssignmentForNextSeason(
        teamId, 
        targetLeague.id, 
        nextSeasonId, 
        AssignmentReason.RELEGATION
      );
    }
    
    // Registrar el descenso en la temporada actual
    await db
      .update(teamLeagueAssignmentTable)
      .set({
        relegatedNextSeason: true,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(teamLeagueAssignmentTable.teamId, teamId),
          eq(teamLeagueAssignmentTable.seasonId, currentSeasonId)
        )
      );
  }
  
  /**
   * Marca un equipo para playoff de ascenso
   */
  private async markTeamForPlayoff(
    teamId: number,
    currentSeasonId: number,
    nextSeasonId?: number
  ): Promise<void> {
    const db = this.databaseService.db;
    
    // Registrar clasificación a playoff en la temporada actual
    await db
      .update(teamLeagueAssignmentTable)
      .set({
        playoffNextSeason: true,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(teamLeagueAssignmentTable.teamId, teamId),
          eq(teamLeagueAssignmentTable.seasonId, currentSeasonId)
        )
      );
  }
  
  /**
   * Marca un equipo para participación en torneos
   */
  private async markTeamForTournament(
    teamId: number,
    currentSeasonId: number
  ): Promise<void> {
    const db = this.databaseService.db;
    
    // Registrar clasificación a torneo en la temporada actual
    await db
      .update(teamLeagueAssignmentTable)
      .set({
        qualifiedForTournament: true,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(teamLeagueAssignmentTable.teamId, teamId),
          eq(teamLeagueAssignmentTable.seasonId, currentSeasonId)
        )
      );
  }
  
  /**
   * Crea una asignación de equipo para la próxima temporada
   */
  private async createTeamAssignmentForNextSeason(
    teamId: number,
    leagueId: number,
    nextSeasonId: number,
    reason: AssignmentReason
  ): Promise<void> {
    const db = this.databaseService.db;
    
    // Obtener información del equipo
    const [team] = await db
      .select()
      .from(teamTable)
      .where(eq(teamTable.id, teamId));
      
    if (!team) {
      this.logger.warn(`No se encontró el equipo con ID ${teamId}`);
      return;
    }
    
    // Verificar si ya existe una asignación para la próxima temporada
    const [existingAssignment] = await db
      .select()
      .from(teamLeagueAssignmentTable)
      .where(
        and(
          eq(teamLeagueAssignmentTable.teamId, teamId),
          eq(teamLeagueAssignmentTable.seasonId, nextSeasonId)
        )
      );
      
    if (existingAssignment) {
      this.logger.log(`Ya existe una asignación para el equipo ${team.name} en la temporada ${nextSeasonId}`);
      return;
    }
    
    // Crear nueva asignación
    await db
      .insert(teamLeagueAssignmentTable)
      .values({
        teamId,
        leagueId,
        seasonId: nextSeasonId,
        tiktokFollowersAtAssignment: team.followers,
        assignmentReason: reason
      });
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
          
          this.logger.log(`Generados ${playoffMatches.length} partidos de playoff para ${division.name}`);
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
   * Cierra la temporada actual y procesa transiciones
   */
  async closeCurrentSeason(createNextSeason: boolean = false): Promise<SeasonTransitionResult> {
    const db = this.databaseService.db;
    
    // Obtener temporada activa
    const [activeSeason] = await db
      .select()
      .from(seasonTable)
      .where(eq(seasonTable.isActive, true));
      
    if (!activeSeason) {
      throw new NotFoundException('No hay temporada activa para cerrar');
    }
    
    return this.finalizeSeason(activeSeason.id, undefined, createNextSeason);
  }

  /**
   * Calcula las clasificaciones dinámicamente para una liga basándose en los partidos jugados
   */
  private async calculateDynamicStandings(
    leagueId: number,
    seasonId: number
  ): Promise<Array<{ teamId: number; teamName: string; position: number; points: number; goalDifference: number }>> {
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
      .where(eq(teamLeagueAssignmentTable.leagueId, leagueId));
    
    // Calcular estadísticas por equipo
    const teamStats = new Map();
    
    // Inicializar estadísticas para todos los equipos
    teamsInLeague.forEach(team => {
      teamStats.set(team.teamId, {
        teamId: team.teamId,
        teamName: team.teamName,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        played: 0
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
        homeStats.wins++;
        homeStats.points += 3;
        awayStats.losses++;
      } else if (match.homeGoals < match.awayGoals) {
        awayStats.wins++;
        awayStats.points += 3;
        homeStats.losses++;
      } else {
        homeStats.draws++;
        awayStats.draws++;
        homeStats.points += 1;
        awayStats.points += 1;
      }
    });
    
    // Convertir a array y ordenar
    // Preparamos el array base con stats extendidos
    let standings = Array.from(teamStats.values()).map(stats => {
      const teamInfo = teamsInLeague.find(t => t.teamId === stats.teamId);
      return {
        teamId: stats.teamId,
        teamName: stats.teamName,
        position: 0, // Se asignará después del ordenamiento
        points: stats.points,
        goalDifference: stats.goalsFor - stats.goalsAgainst,
        goalsFor: stats.goalsFor,
        goalsAgainst: stats.goalsAgainst,
        played: stats.played,
        followers: teamInfo && typeof teamInfo.followers === 'number' ? teamInfo.followers : 0
      };
    });

    // Agrupar por puntos
    const groupsByPoints = new Map<number, any[]>();
    standings.forEach(team => {
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
      } else {
        // 1. Enfrentamientos directos (diferencia de goles entre los empatados)
        // Filtrar partidos solo entre los equipos empatados
        const ids = group.map(t => t.teamId);
        const directMatches = completedMatches.filter(m => ids.includes(m.homeTeamId) && ids.includes(m.awayTeamId));
        // Calcular mini-liga de enfrentamientos directos
        const directStats = new Map<number, { points: number; goalDiff: number; goalsFor: number; followers: number }>();
        group.forEach(t => directStats.set(t.teamId, { points: 0, goalDiff: 0, goalsFor: 0, followers: t.followers || 0 }));
        directMatches.forEach(m => {
          // Home
          if (directStats.has(m.homeTeamId) && typeof m.homeGoals === 'number' && typeof m.awayGoals === 'number') {
            let s = directStats.get(m.homeTeamId)!;
            s.goalsFor += m.homeGoals;
            s.goalDiff += m.homeGoals - m.awayGoals;
            if (m.homeGoals > m.awayGoals) s.points += 3;
            else if (m.homeGoals === m.awayGoals) s.points += 1;
          }
          // Away
          if (directStats.has(m.awayTeamId) && typeof m.homeGoals === 'number' && typeof m.awayGoals === 'number') {
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
          // 3. Diferencia de goles general
          if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
          // 4. Goles a favor general
          if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
          // 5. Seguidores
          if ((b.followers || 0) !== (a.followers || 0))
            return (b.followers || 0) - (a.followers || 0);
          // 6. Sorteo (aleatorio)
          return Math.random() - 0.5;
        });
        sortedStandings.push(...group);
      }
    }

    // Asignar posiciones
    sortedStandings.forEach((team, index) => {
      team.position = index + 1;
    });

    this.logger.log(`Clasificación calculada para liga ${leagueId}: ${sortedStandings.length} equipos`);
    return sortedStandings;
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
    
    // Obtener ligas de la división
    const leagues = await db
      .select({ id: leagueTable.id })
      .from(leagueTable)
      .where(eq(leagueTable.divisionId, divisionId));
      
    if (leagues.length === 0) return true; // Si no hay ligas, no hay playoffs pendientes
    
    const leagueIds = leagues.map(l => l.id);
    
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
      
    return Number(pendingPlayoffs.count) === 0;
  }
  
  /**
   * Obtiene los ganadores de playoffs de una división
   */
  async getPlayoffWinners(divisionId: number, seasonId: number): Promise<Array<{teamId: number; teamName: string; round: string}>> {
    const db = this.databaseService.db;
    
    // Obtener ligas de la división
    const leagues = await db
      .select({ id: leagueTable.id })
      .from(leagueTable)
      .where(eq(leagueTable.divisionId, divisionId));
      
    if (leagues.length === 0) return [];
    
    const leagueIds = leagues.map(l => l.id);
    
    // Obtener todos los partidos de playoff completados
    const playoffMatches = await db
      .select({
        homeTeamId: matchTable.homeTeamId,
        awayTeamId: matchTable.awayTeamId,
        homeGoals: matchTable.homeGoals,
        awayGoals: matchTable.awayGoals,
        round: matchTable.playoffRound,
        homeTeamName: sql<string>`home_team.name`,
        awayTeamName: sql<string>`away_team.name`
      })
      .from(matchTable)
      .innerJoin(sql`${teamTable} as home_team`, eq(matchTable.homeTeamId, sql`home_team.id`))
      .innerJoin(sql`${teamTable} as away_team`, eq(matchTable.awayTeamId, sql`away_team.id`))
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          inArray(matchTable.leagueId, leagueIds),
          eq(matchTable.isPlayoff, true),
          sql`${matchTable.homeGoals} IS NOT NULL AND ${matchTable.awayGoals} IS NOT NULL`
        )
      );
    
    // Procesar resultados para determinar ganadores
    const winners: Array<{teamId: number; teamName: string; round: string}> = [];
    
    // Agrupar por ronda y equipos
    const matchesByTeams = new Map<string, any[]>();
    
    playoffMatches.forEach(match => {
      const key1 = `${match.homeTeamId}-${match.awayTeamId}`;
      const key2 = `${match.awayTeamId}-${match.homeTeamId}`;
      
      if (!matchesByTeams.has(key1)) {
        matchesByTeams.set(key1, []);
      }
      matchesByTeams.get(key1)!.push(match);
    });
    
    // Calcular ganadores de cada enfrentamiento
    for (const [key, matches] of matchesByTeams) {
      if (matches.length === 2) { // Ida y vuelta
        const totalHome = matches.reduce((sum, m) => sum + (m.homeTeamId === matches[0].homeTeamId ? m.homeGoals : m.awayGoals), 0);
        const totalAway = matches.reduce((sum, m) => sum + (m.awayTeamId === matches[0].awayTeamId ? m.awayGoals : m.homeGoals), 0);
        
        if (totalHome > totalAway) {
          winners.push({
            teamId: matches[0].homeTeamId,
            teamName: matches[0].homeTeamName,
            round: matches[0].round
          });
        } else if (totalAway > totalHome) {
          winners.push({
            teamId: matches[0].awayTeamId,
            teamName: matches[0].awayTeamName,
            round: matches[0].round
          });
        }
      } else if (matches.length === 1) { // Partido único
        const match = matches[0];
        if (match.homeGoals > match.awayGoals) {
          winners.push({
            teamId: match.homeTeamId,
            teamName: match.homeTeamName,
            round: match.round
          });
        } else if (match.awayGoals > match.homeGoals) {
          winners.push({
            teamId: match.awayTeamId,
            teamName: match.awayTeamName,
            round: match.round
          });
        }
      }
    }
    
    return winners;
  }
  
  /**
   * Genera un reporte completo del estado de cierre de temporada
   */
  async generateSeasonClosureReport(seasonId: number): Promise<SeasonClosureReport> {
    const db = this.databaseService.db;
    
    const report: SeasonClosureReport = {
      currentSeasonId: seasonId,
      promotions: [],
      relegations: [],
      playoffResults: [],
      tournamentQualifiers: [],
      pendingPlayoffs: [],
      errors: []
    };
    
    try {
      // Obtener todas las divisiones
      const divisions = await db
        .select()
        .from(divisionTable)
        .orderBy(asc(divisionTable.level));
      
      for (const division of divisions) {
        // Verificar estado de temporada regular
        const regularComplete = await this.isDivisionRegularSeasonComplete(division.id, seasonId);
        
        if (!regularComplete) {
          report.errors.push(`División ${division.name}: temporada regular no completada`);
          continue;
        }
        
        // Verificar playoffs si corresponde
        if (Number(division.promotePlayoffSlots || 0) > 0) {
          const playoffsComplete = await this.areDivisionPlayoffsComplete(division.id, seasonId);
          
          if (!playoffsComplete) {
            // Contar equipos en playoffs pendientes
            const leagues = await db
              .select({ id: leagueTable.id })
              .from(leagueTable)
              .where(eq(leagueTable.divisionId, division.id));
              
            const leagueIds = leagues.map(l => l.id);
            
            const [playoffTeamsCount] = await db
              .select({ count: sql<number>`count(DISTINCT COALESCE(${matchTable.homeTeamId}, ${matchTable.awayTeamId}))` })
              .from(matchTable)
              .where(
                and(
                  eq(matchTable.seasonId, seasonId),
                  inArray(matchTable.leagueId, leagueIds),
                  eq(matchTable.isPlayoff, true)
                )
              );
            
            report.pendingPlayoffs.push({
              divisionId: division.id,
              divisionName: division.name,
              teamsCount: Number(playoffTeamsCount.count)
            });
            continue;
          }
          
          // Obtener ganadores de playoffs
          const playoffWinners = await this.getPlayoffWinners(division.id, seasonId);
          report.playoffResults.push(...playoffWinners.map(w => ({
            homeTeamId: 0, // No aplicable en resumen
            awayTeamId: 0, // No aplicable en resumen  
            homeGoals: 0,
            awayGoals: 0,
            round: w.round,
            winnerId: w.teamId,
            isComplete: true
          })));
        }
        
        // Obtener equipos marcados para ascenso
        const promotedTeams = await db
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
        
        report.promotions.push(...promotedTeams.map(t => ({
          teamId: t.teamId,
          teamName: t.teamName,
          fromDivision: t.divisionLevel,
          toDivision: t.divisionLevel - 1
        })));
        
        // Obtener equipos marcados para descenso
        const relegatedTeams = await db
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
        
        report.relegations.push(...relegatedTeams.map(t => ({
          teamId: t.teamId,
          teamName: t.teamName,
          fromDivision: t.divisionLevel,
          toDivision: t.divisionLevel + 1
        })));
        
        // Obtener equipos clasificados a torneos
        const tournamentTeams = await db
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
        
        report.tournamentQualifiers.push(...tournamentTeams.map(t => ({
          teamId: t.teamId,
          teamName: t.teamName,
          divisionLevel: t.divisionLevel
        })));
      }
    } catch (error) {
      this.logger.error('Error generando reporte de cierre de temporada:', error);
      report.errors.push(`Error general: ${error.message}`);
    }
    
    return report;
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
    
    this.logger.log(`Iniciando transición completa de temporada ${currentSeasonId}`);
    
    // 1. Generar reporte de estado actual
    const transitionReport = await this.generateSeasonClosureReport(currentSeasonId);
    
    // 2. Verificar que todas las divisiones están listas
    if (transitionReport.pendingPlayoffs.length > 0) {
      throw new BadRequestException(
        `No se puede procesar la transición. Playoffs pendientes en: ${transitionReport.pendingPlayoffs.map(p => p.divisionName).join(', ')}`
      );
    }
    
    if (transitionReport.errors.length > 0) {
      throw new BadRequestException(
        `No se puede procesar la transición. Errores encontrados: ${transitionReport.errors.join(', ')}`
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
    
    this.logger.log(`Transición completada: ${currentSeason.name} → ${nextSeason.name}`);
    
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
   * Obtiene la temporada activa
   */
  async getActiveSeason() {
    const db = this.databaseService.db;
    
    const [season] = await db
      .select()
      .from(seasonTable)
      .where(eq(seasonTable.isActive, true))
      .limit(1);
    
    if (!season) {
      throw new NotFoundException('No hay temporada activa');
    }
    
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
              scheduledDate: semifinalDate.toISOString().split('T')[0],
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
              scheduledDate: semifinalDate.toISOString().split('T')[0],
              status: MatchStatus.SCHEDULED,
              isPlayoff: true,
              playoffRound: 'Semifinal',
              createdAt: new Date(),
              updatedAt: new Date()
            });

            this.logger.log(`🏆 Semifinales creadas automáticamente para ${divisionData.divisionName} tras completar cuartos`);
            this.logger.log(`   📅 Fecha: ${semifinalDate.toLocaleDateString()}`);
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
              scheduledDate: finalDate.toISOString().split('T')[0],
              status: MatchStatus.SCHEDULED,
              isPlayoff: true,
              playoffRound: 'Final',
              createdAt: new Date(),
              updatedAt: new Date()
            });

            this.logger.log(`🏆 Final creada automáticamente para ${divisionData.divisionName}`);
            this.logger.log(`   📅 Fecha: ${finalDate.toLocaleDateString()}`);
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
      
      this.logger.log(`✅ Creadas semifinales de playoff para División 3 (cruces entre grupos):`);
      this.logger.log(`   🏟️ Semifinal 1: ${leaguePlayoffTeams[0].teams[0].teamName} (2ºA) vs ${leaguePlayoffTeams[1].teams[1].teamName} (3ºB)`);
      this.logger.log(`   🏟️ Semifinal 2: ${leaguePlayoffTeams[1].teams[0].teamName} (2ºB) vs ${leaguePlayoffTeams[0].teams[1].teamName} (3ºA)`);
      this.logger.log(`   📅 Fecha programada: ${startDate.toLocaleDateString()}`);
      
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

        this.logger.log(`✅ Creadas semifinales de playoff para División 4:`);
        this.logger.log(`   🏟️ Semifinal 1: ${grupoA.teamName} (2º A) vs ${grupoD.teamName} (2º D)`);
        this.logger.log(`   🏟️ Semifinal 2: ${grupoB.teamName} (2º B) vs ${grupoC.teamName} (2º C)`);
        this.logger.log(`   📅 Fecha programada: ${startDate.toLocaleDateString()}`);
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

      this.logger.log(`✅ Creados cuartos de final de playoff para División 5:`);
      emparejamientos.forEach((emp, i) => {
        const equipoHome = allTeams.find(t => t.groupCode === emp.home);
        const equipoAway = allTeams.find(t => t.groupCode === emp.away);
        if (equipoHome && equipoAway) {
          this.logger.log(`   🏟️ Cuarto ${i + 1}: ${equipoHome.teamName} (2º ${emp.home}) vs ${equipoAway.teamName} (2º ${emp.away})`);
        }
      });
      this.logger.log(`   📅 Fecha programada: ${startDate.toLocaleDateString()}`);
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
      this.logger.log(`🏆 Procesando ganadores de playoffs para ascenso en temporada ${seasonId}...`);
      
      // Obtener todas las divisiones que tienen playoffs
      const divisions = await db
        .select()
        .from(divisionTable)
        .where(sql`${divisionTable.promotePlayoffSlots} > 0`)
        .orderBy(asc(divisionTable.level));
      
      for (const division of divisions) {
        // Verificar si los playoffs de esta división están completos
        const playoffsComplete = await this.areDivisionPlayoffsComplete(division.id, seasonId);
        
        if (playoffsComplete) {
          // Buscar finales completadas de esta división
          const leagues = await db
            .select({ id: leagueTable.id })
            .from(leagueTable)
            .where(eq(leagueTable.divisionId, division.id));
            
          if (leagues.length === 0) continue;
          
          const leagueIds = leagues.map(l => l.id);
          
          // Obtener finales completadas
          const completedFinals = await db
            .select({
              homeTeamId: matchTable.homeTeamId,
              awayTeamId: matchTable.awayTeamId,
              homeGoals: matchTable.homeGoals,
              awayGoals: matchTable.awayGoals,
              homeTeamName: sql<string>`home_team.name`,
              awayTeamName: sql<string>`away_team.name`
            })
            .from(matchTable)
            .innerJoin(sql`${teamTable} as home_team`, eq(matchTable.homeTeamId, sql`home_team.id`))
            .innerJoin(sql`${teamTable} as away_team`, eq(matchTable.awayTeamId, sql`away_team.id`))
            .where(
              and(
                eq(matchTable.seasonId, seasonId),
                inArray(matchTable.leagueId, leagueIds),
                eq(matchTable.isPlayoff, true),
                eq(matchTable.playoffRound, 'Final'),
                eq(matchTable.status, MatchStatus.FINISHED)
              )
            );
          
          // Procesar cada final completada
          for (const final of completedFinals) {
            // Verificar que los goles no sean null
            if (final.homeGoals === null || final.awayGoals === null) {
              this.logger.warn(`Final sin resultado válido en ${division.name}: ${final.homeTeamName} vs ${final.awayTeamName}`);
              continue;
            }
            
            let winnerId: number;
            let winnerName: string;
            
            // Determinar el ganador
            if (final.homeGoals > final.awayGoals) {
              winnerId = final.homeTeamId;
              winnerName = final.homeTeamName;
            } else if (final.awayGoals > final.homeGoals) {
              winnerId = final.awayTeamId;
              winnerName = final.awayTeamName;
            } else {
              this.logger.warn(`Final empatada en ${division.name}: ${final.homeTeamName} vs ${final.awayTeamName}`);
              continue; // Saltar empates (no deberían ocurrir)
            }
            
            // Verificar si el equipo ya está marcado para ascenso
            const [existingPromotion] = await db
              .select()
              .from(teamLeagueAssignmentTable)
              .where(
                and(
                  eq(teamLeagueAssignmentTable.teamId, winnerId),
                  eq(teamLeagueAssignmentTable.seasonId, seasonId),
                  eq(teamLeagueAssignmentTable.promotedNextSeason, true)
                )
              );
            
            if (!existingPromotion) {
              // Marcar al ganador para ascenso
              await db
                .update(teamLeagueAssignmentTable)
                .set({
                  promotedNextSeason: true,
                  playoffNextSeason: false, // Ya no está en playoff, ha ganado
                  updatedAt: new Date()
                })
                .where(
                  and(
                    eq(teamLeagueAssignmentTable.teamId, winnerId),
                    eq(teamLeagueAssignmentTable.seasonId, seasonId)
                  )
                );
              
              this.logger.log(`🎉 ${winnerName} marcado para ascenso tras ganar final de ${division.name}`);
            } else {
              this.logger.log(`✅ ${winnerName} ya estaba marcado para ascenso en ${division.name}`);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error procesando ganadores de playoffs:', error);
    }
  }

  /**
   * Marca automáticamente a los equipos según su posición final en liga regular
   * Se ejecuta cuando se completa la temporada regular, antes de playoffs
   */
  async markTeamsBasedOnRegularSeasonPosition(divisionId: number, seasonId: number): Promise<void> {
    const db = this.databaseService.db;
    
    try {
      this.logger.log(`📊 Marcando equipos por posición final en liga regular - División ${divisionId}, Temporada ${seasonId}`);
      
      // Obtener información de la división
      const [division] = await db
        .select()
        .from(divisionTable)
        .where(eq(divisionTable.id, divisionId));
        
      if (!division) {
        this.logger.warn(`División ${divisionId} no encontrada`);
        return;
      }
      
      // Obtener todas las ligas de esta división
      const leagues = await db
        .select()
        .from(leagueTable)
        .where(eq(leagueTable.divisionId, divisionId));
        
      for (const league of leagues) {
        // Calcular clasificación final dinámicamente
        const standings = await this.calculateDynamicStandings(league.id, seasonId);
        
        if (standings.length === 0) {
          this.logger.warn(`No hay clasificación disponible para la liga ${league.name}`);
          continue;
        }
        
        this.logger.log(`🏆 Procesando clasificación final de ${league.name} (${standings.length} equipos)`);
        
        // 1. MARCAR EQUIPOS PARA TORNEOS (solo División 1)
        if (Number(division.tournamentSlots || 0) > 0 && division.level === 1) {
          const tournamentTeams = standings.slice(0, Number(division.tournamentSlots || 0));
          
          for (const team of tournamentTeams) {
            await this.markTeamForTournament(team.teamId, seasonId);
            this.logger.log(`🏆 ${team.teamName} clasificado para torneo (${team.position}º puesto)`);
          }
        }
        
        // 2. MARCAR ASCENSOS DIRECTOS
        if (Number(division.promoteSlots || 0) > 0 && division.level > 1) {
          const directPromoteTeams = standings.slice(0, Number(division.promoteSlots || 0));
          
          for (const team of directPromoteTeams) {
            await this.markTeamForPromotion(team.teamId, seasonId);
            this.logger.log(`⬆️ ${team.teamName} asciende directamente (${team.position}º puesto)`);
          }
        }
        
        // 3. MARCAR EQUIPOS PARA PLAYOFFS DE ASCENSO
        if (Number(division.promotePlayoffSlots || 0) > 0 && division.level > 1) {
          const startPos = Number(division.promoteSlots || 0) + 1; // Después de los ascensos directos
          const endPos = startPos + Number(division.promotePlayoffSlots || 0) - 1;
          const playoffTeams = standings.filter(team => 
            team.position >= startPos && team.position <= endPos
          );
          
          for (const team of playoffTeams) {
            await this.markTeamForPlayoff(team.teamId, seasonId);
            this.logger.log(`🎯 ${team.teamName} clasificado para playoff de ascenso (${team.position}º puesto)`);
          }
        }
        
        // 4. MARCAR DESCENSOS DIRECTOS
        if (Number(division.relegateSlots || 0) > 0 && division.level < 5) {
          const relegationStartPos = standings.length - Number(division.relegateSlots || 0) + 1;
          const teamsToRelegate = standings.filter(team => team.position >= relegationStartPos);
          
          for (const team of teamsToRelegate) {
            await this.markTeamForRelegation(team.teamId, seasonId);
            this.logger.log(`⬇️ ${team.teamName} desciende directamente (${team.position}º puesto)`);
          }
        }
      }
      
      this.logger.log(`✅ Marcado completado para División ${division.name}`);
      
    } catch (error) {
      this.logger.error(`❌ Error marcando equipos por posición final en División ${divisionId}:`, error);
    }
  }

  /**
   * Actualiza los estados de equipos después de un partido de playoff
   * Los equipos eliminados pasan de playoff a seguro
   * Los ganadores de finales pasan de playoff a ascenso
   */
  async updateTeamStatusAfterPlayoffMatch(matchId: number): Promise<void> {
    const db = this.databaseService.db;
    
    try {
      this.logger.log(`🔄 Actualizando estados de equipos tras partido de playoff ${matchId}...`);
      
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
          divisionName: divisionTable.name
        })
        .from(matchTable)
        .innerJoin(leagueTable, eq(matchTable.leagueId, leagueTable.id))
        .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
        .where(eq(matchTable.id, matchId));

      if (!match || !match.isPlayoff || match.status !== MatchStatus.FINISHED) {
        this.logger.debug(`⚠️ Partido ${matchId} no es un playoff completado (isPlayoff: ${match?.isPlayoff}, status: ${match?.status})`);
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

      // Lógica según la ronda del playoff
      if (match.playoffRound === 'Final') {
        // FINAL: El ganador asciende, el perdedor queda seguro
        
        this.logger.log(`🔄 Marcando ganador ${winnerId} (${winnerName}) para ascenso...`);
        
        // Ganador: marcar para ascenso
        const winnerUpdateResult = await db
          .update(teamLeagueAssignmentTable)
          .set({
            promotedNextSeason: true,
            playoffNextSeason: false, // Ya no está en playoff
            updatedAt: new Date()
          })
          .where(
            and(
              eq(teamLeagueAssignmentTable.teamId, winnerId),
              eq(teamLeagueAssignmentTable.seasonId, match.seasonId)
            )
          );

        this.logger.log(`📊 Resultado actualización ganador:`, winnerUpdateResult);

        this.logger.log(`🔄 Marcando perdedor ${loserId} (${loserName}) como NO playoff...`);

        // Perdedor: quitar de playoff (queda seguro)
        const loserUpdateResult = await db
          .update(teamLeagueAssignmentTable)
          .set({
            playoffNextSeason: false, // Ya no está en playoff
            updatedAt: new Date()
          })
          .where(
            and(
              eq(teamLeagueAssignmentTable.teamId, loserId),
              eq(teamLeagueAssignmentTable.seasonId, match.seasonId)
            )
          );

        this.logger.log(`📊 Resultado actualización perdedor:`, loserUpdateResult);

        // Verificar estados después de las actualizaciones
        const verifyWinner = await db
          .select({
            teamId: teamLeagueAssignmentTable.teamId,
            playoffNextSeason: teamLeagueAssignmentTable.playoffNextSeason,
            promotedNextSeason: teamLeagueAssignmentTable.promotedNextSeason,
            relegatedNextSeason: teamLeagueAssignmentTable.relegatedNextSeason
          })
          .from(teamLeagueAssignmentTable)
          .where(
            and(
              eq(teamLeagueAssignmentTable.teamId, winnerId),
              eq(teamLeagueAssignmentTable.seasonId, match.seasonId)
            )
          );

        const verifyLoser = await db
          .select({
            teamId: teamLeagueAssignmentTable.teamId,
            playoffNextSeason: teamLeagueAssignmentTable.playoffNextSeason,
            promotedNextSeason: teamLeagueAssignmentTable.promotedNextSeason,
            relegatedNextSeason: teamLeagueAssignmentTable.relegatedNextSeason
          })
          .from(teamLeagueAssignmentTable)
          .where(
            and(
              eq(teamLeagueAssignmentTable.teamId, loserId),
              eq(teamLeagueAssignmentTable.seasonId, match.seasonId)
            )
          );

        this.logger.log(`🔍 Estado verificado del ganador ${winnerId} tras actualización:`, verifyWinner[0]);
        this.logger.log(`🔍 Estado verificado del perdedor ${loserId} tras actualización:`, verifyLoser[0]);

        this.logger.log(`🏆 Final de playoff en ${match.divisionName}:`);
        this.logger.log(`   ✅ ${winnerName} → Asciende`);
        this.logger.log(`   ❌ ${loserName} → Seguro`);

      } else {
        // SEMIFINAL o CUARTOS: El perdedor es eliminado (queda seguro)
        
        this.logger.log(`🔄 Intentando marcar equipo ${loserId} (${loserName}) como NO playoff...`);
        
        const updateResult = await db
          .update(teamLeagueAssignmentTable)
          .set({
            playoffNextSeason: false, // Eliminado del playoff
            updatedAt: new Date()
          })
          .where(
            and(
              eq(teamLeagueAssignmentTable.teamId, loserId),
              eq(teamLeagueAssignmentTable.seasonId, match.seasonId)
            )
          );

        this.logger.log(`📊 Resultado de la actualización:`, updateResult);

        // Verificar el estado actual después de la actualización
        const verifyUpdate = await db
          .select({
            teamId: teamLeagueAssignmentTable.teamId,
            playoffNextSeason: teamLeagueAssignmentTable.playoffNextSeason,
            promotedNextSeason: teamLeagueAssignmentTable.promotedNextSeason,
            relegatedNextSeason: teamLeagueAssignmentTable.relegatedNextSeason
          })
          .from(teamLeagueAssignmentTable)
          .where(
            and(
              eq(teamLeagueAssignmentTable.teamId, loserId),
              eq(teamLeagueAssignmentTable.seasonId, match.seasonId)
            )
          );

        this.logger.log(`🔍 Estado verificado del equipo ${loserId} tras actualización:`, verifyUpdate[0]);

        this.logger.log(`⚽ ${match.playoffRound} de playoff en ${match.divisionName}:`);
        this.logger.log(`   ✅ ${winnerName} → Sigue en playoff`);
        this.logger.log(`   ❌ ${loserName} → Eliminado (seguro)`);
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
      this.logger.log(`🔍 DEBUG: Verificando estados de equipos en temporada ${seasonId}${divisionName ? ` - División ${divisionName}` : ''}...`);
      
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

      this.logger.log(`📊 Estados de equipos encontrados (${teamStatuses.length} equipos):`);
      teamStatuses.forEach(team => {
        const status: string[] = [];
        if (team.playoffNextSeason) status.push('PLAYOFF');
        if (team.promotedNextSeason) status.push('ASCENSO');
        if (team.relegatedNextSeason) status.push('DESCENSO');
        if (team.qualifiedForTournament) status.push('TORNEO');
        if (status.length === 0) status.push('SEGURO');

        this.logger.log(`   ${team.teamName} (${team.divisionName}): ${status.join(', ')}`);
      });

    } catch (error) {
      this.logger.error(`❌ Error en debug de estados de equipos:`, error);
    }
  }

  /**
   * Limpia todos los estados de playoff/ascenso/descenso al iniciar nueva temporada
   */
  async clearAllTeamStatusForNewSeason(seasonId: number): Promise<void> {
    const db = this.databaseService.db;
    
    try {
      const result = await db
        .update(teamLeagueAssignmentTable)
        .set({
          promotedNextSeason: false,
          relegatedNextSeason: false,
          playoffNextSeason: false,
          qualifiedForTournament: false,
          updatedAt: new Date()
        })
        .where(eq(teamLeagueAssignmentTable.seasonId, seasonId));

      this.logger.log(`🧹 Estados de equipos limpiados para temporada ${seasonId}`);
      
    } catch (error) {
      this.logger.error(`❌ Error limpiando estados de equipos para temporada ${seasonId}:`, error);
    }
  }
}
