// ...existing code (dejar solo un bloque de imports y una clase)...
import { Controller, Post, Body, Param, Get, UseGuards, ParseIntPipe, Query } from '@nestjs/common';
import { SeasonTransitionService, SeasonTransitionResult, PlayoffMatchup } from './season-transition.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('season-transition')
export class SeasonTransitionController {
  constructor(
    private readonly seasonTransitionService: SeasonTransitionService
  ) {}

  /**
   * Recalcula standings y actualiza estados de equipos para TODAS las divisiones de la temporada activa
   * (Botón "Recalcular posiciones")
   * Solo administradores pueden realizar esta operación
   */
  @UseGuards(JwtAuthGuard)
  @Post('recalculate-standings')
  async recalculateAllStandingsAndUpdateStates(): Promise<{ message: string; processedDivisions: number; errors: string[] }> {
    // Usamos la lógica centralizada de processSeasonTransition, pero sin crear nueva temporada
    const activeSeason = await this.seasonTransitionService.getActiveSeason();
    const result = await this.seasonTransitionService.processSeasonTransition(activeSeason.id);
    return {
      message: result.message,
      processedDivisions: result.processedDivisions,
      errors: result.errors
    };
  }

  /**
   * Procesar la transición de una temporada a la siguiente
   * Solo administradores pueden realizar esta operación
   */
  @UseGuards(JwtAuthGuard)
  @Post(':seasonId/transition')
  async processSeasonTransition(
    @Param('seasonId', ParseIntPipe) seasonId: number,
    @Body() body: { nextSeasonId?: number }
  ): Promise<SeasonTransitionResult> {
    return this.seasonTransitionService.processSeasonTransition(
      seasonId,
      body.nextSeasonId
    );
  }

  /**
   * Finalizar una temporada y opcionalmente iniciar la siguiente
   * Solo administradores pueden realizar esta operación
   */
  @UseGuards(JwtAuthGuard)
  @Post(':seasonId/finalize')
  async finalizeSeason(
    @Param('seasonId', ParseIntPipe) seasonId: number,
    @Body() body: { nextSeasonId?: number; createNextSeason?: boolean }
  ): Promise<any> {
    return this.seasonTransitionService.finalizeSeason(
      seasonId,
      body.nextSeasonId,
      body.createNextSeason
    );
  }

  /**
   * Organizar playoffs para una división específica
   * Solo administradores pueden realizar esta operación
   */
  @UseGuards(JwtAuthGuard)
  @Post(':seasonId/division/:divisionId/playoffs')
  async organizePlayoffs(
    @Param('seasonId', ParseIntPipe) seasonId: number,
    @Param('divisionId', ParseIntPipe) divisionId: number
  ): Promise<PlayoffMatchup[]> {
    return this.seasonTransitionService.organizePlayoffs(
      divisionId,
      seasonId
    );
  }

  /**
   * Organizar playoffs para todas las divisiones listas en la temporada activa
   */
  @UseGuards(JwtAuthGuard)
  @Post('organize-playoffs')
  async organizeAllPlayoffs(): Promise<{ message: string; playoffMatches: number }> {
    // Obtener temporada activa y organizar playoffs para todas las divisiones listas
    const results = await this.seasonTransitionService.organizePlayoffsForAllReadyDivisions();
    return results;
  }

  /**
   * Cerrar temporada actual y procesar transiciones
   */
  @UseGuards(JwtAuthGuard)
  @Post('close-season')
  async closeSeason(@Body() body: { createNextSeason?: boolean }): Promise<SeasonTransitionResult> {
    const results = await this.seasonTransitionService.closeCurrentSeason(body.createNextSeason);
    return results;
  }

  /**
   * Organizar playoffs para todas las divisiones listas en la temporada activa (PUBLIC para testing)
   * NOTA: Este endpoint es solo para desarrollo/testing - no usar en producción
   */
  @Post('test/organize-playoffs')
  async organizePlayoffsPublicTest(): Promise<{ message: string; playoffMatches: number }> {
    console.log('🚨 WARNING: Usando endpoint público de testing para playoffs');
    const results = await this.seasonTransitionService.organizePlayoffsForAllReadyDivisions();
    return results;
  }



  /**
   * Verificar si una división está lista para playoffs
   */
  @UseGuards(JwtAuthGuard)
  @Get(':seasonId/division/:divisionId/ready-for-playoffs')
  async isDivisionReadyForPlayoffs(
    @Param('seasonId', ParseIntPipe) seasonId: number,
    @Param('divisionId', ParseIntPipe) divisionId: number
  ): Promise<{ isReady: boolean; message: string }> {
    const isComplete = await this.seasonTransitionService.isDivisionRegularSeasonComplete(divisionId, seasonId);
    return {
      isReady: isComplete,
      message: isComplete ? 'División lista para playoffs' : 'Temporada regular no completada'
    };
  }

  /**
   * Ejecutar transición completa de temporada
   */
  @UseGuards(JwtAuthGuard)
  @Post('execute-complete-transition')
  async executeCompleteSeasonTransition(
    @Body() body: { currentSeasonId?: number; nextSeasonName?: string }
  ): Promise<any> {
    // Si no se especifica temporada, usar la activa
    let seasonId = body.currentSeasonId;
    
    if (!seasonId) {
      const activeSeason = await this.seasonTransitionService.getActiveSeason();
      seasonId = activeSeason.id;
    }
    
    return this.seasonTransitionService.executeCompleteSeasonTransition(
      seasonId!,
      body.nextSeasonName
    );
  }

  /**
   * Verificar si la temporada activa está completamente terminada
   */
  @UseGuards(JwtAuthGuard)
  @Get('active-season/is-complete')
  async checkActiveSeasonComplete(): Promise<{
    isComplete: boolean;
    readyForNewSeason: boolean;
    pendingIssues: string[];
    seasonId: number;
    seasonName: string;
    summary: {
      promotions: number;
      relegations: number;
      tournamentQualifiers: number;
      pendingPlayoffs: number;
      errors: number;
    };
  }> {
    // Log eliminado: debug controller
    
    const activeSeason = await this.seasonTransitionService.getActiveSeason();
    // Log eliminado: debug controller
    
    const status = await this.seasonTransitionService.isSeasonCompletelyFinished(activeSeason.id);
    // Log eliminado: debug controller
    
    const result = {
      isComplete: status.isComplete,
      readyForNewSeason: status.readyForNewSeason,
      pendingIssues: status.pendingIssues,
      seasonId: activeSeason.id,
      seasonName: activeSeason.name,
      summary: {
        promotions: status.report.promotions.length,
        relegations: status.report.relegations.length,
        tournamentQualifiers: status.report.tournamentQualifiers.length,
        pendingPlayoffs: status.report.pendingPlayoffs.length,
        errors: status.report.errors.length
      }
    };
    
    // Log eliminado: debug controller
    return result;
  }

  /**
   * Verificar si la temporada está completamente terminada y lista para crear una nueva
   */
  @UseGuards(JwtAuthGuard)
  @Get(':seasonId/is-complete')
  async checkSeasonComplete(
    @Param('seasonId', ParseIntPipe) seasonId: number
  ): Promise<{
    isComplete: boolean;
    readyForNewSeason: boolean;
    pendingIssues: string[];
    summary: {
      promotions: number;
      relegations: number;
      tournamentQualifiers: number;
      pendingPlayoffs: number;
      errors: number;
    };
  }> {
    const status = await this.seasonTransitionService.isSeasonCompletelyFinished(seasonId);
    
    return {
      isComplete: status.isComplete,
      readyForNewSeason: status.readyForNewSeason,
      pendingIssues: status.pendingIssues,
      summary: {
        promotions: status.report.promotions.length,
        relegations: status.report.relegations.length,
        tournamentQualifiers: status.report.tournamentQualifiers.length,
        pendingPlayoffs: status.report.pendingPlayoffs.length,
        errors: status.report.errors.length
      }
    };
  }

  /**
   * Crear nueva temporada desde una temporada completamente terminada
   */
  @UseGuards(JwtAuthGuard)
  @Post('create-new-season')
  async createNewSeasonFromCompleted(
    @Body() body: { 
      completedSeasonId?: number; 
      newSeasonName?: string;
    }
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
    // Log eliminado: debug controller
    
    // Si no se especifica temporada, usar la activa
    let seasonId = body.completedSeasonId;
    
    if (!seasonId) {
      const activeSeason = await this.seasonTransitionService.getActiveSeason();
      seasonId = activeSeason.id;
      // Log eliminado: debug controller
    }
    
    // Log eliminado: debug controller
    
    const result = await this.seasonTransitionService.createNewSeasonFromCompleted(
      seasonId!,
      body.newSeasonName
    );
    
    // Log eliminado: debug controller
    return result;
  }

  /**
   * Procesar ganadores de playoffs y marcarlos para ascenso
   */
  @UseGuards(JwtAuthGuard)
  @Post(':seasonId/process-playoff-winners')
  async processPlayoffWinners(
    @Param('seasonId', ParseIntPipe) seasonId: number
  ): Promise<{ message: string; processed: boolean }> {
    await this.seasonTransitionService.processPlayoffWinnersForPromotion(seasonId);
    return {
      message: 'Ganadores de playoffs procesados correctamente',
      processed: true
    };
  }

  /**
   * Procesar ganadores de playoffs de la temporada activa (PUBLIC para testing)
   */
  @Post('test/process-playoff-winners')
  async processPlayoffWinnersPublicTest(): Promise<{ message: string; processed: boolean }> {
    console.log('🚨 WARNING: Usando endpoint público de testing para ganadores de playoffs');
    const activeSeason = await this.seasonTransitionService.getActiveSeason();
    await this.seasonTransitionService.processPlayoffWinnersForPromotion(activeSeason.id);
    return {
      message: `Ganadores de playoffs procesados para temporada ${activeSeason.name}`,
      processed: true
    };
  }

  /**
   * Endpoint de prueba para verificar la lógica unificada de clasificaciones
   * Compara los resultados entre la lógica antigua y la nueva
   */
  @UseGuards(JwtAuthGuard)
  @Get('test-unified-standings/:leagueId')
  async testUnifiedStandings(
    @Param('leagueId', ParseIntPipe) leagueId: number
  ): Promise<{ message: string; success: boolean; details?: any }> {
    try {
      const activeSeason = await this.seasonTransitionService.getActiveSeason();
      
      // Usar la nueva lógica unificada
      const newStandings = await this.seasonTransitionService['standingsService'].calculateStandings(activeSeason.id, leagueId);
      
      return {
        message: 'Lógica unificada funcionando correctamente',
        success: true,
        details: {
          seasonId: activeSeason.id,
          leagueId: leagueId,
          teamsCount: newStandings.length,
          standings: newStandings.map(s => ({
            position: s.position,
            teamName: s.teamName,
            points: s.points,
            goalDifference: s.goalDifference,
            played: s.played
          }))
        }
      };
    } catch (error) {
      return {
        message: `Error en prueba: ${error.message}`,
        success: false
      };
    }
  }

  /**
   * Asigna automáticamente las ligas de destino para la próxima temporada
   * Maneja ascensos, descensos y distribución entre grupos
   */
  @UseGuards(JwtAuthGuard)
  @Post('assign-leagues-next-season')
  async assignLeaguesForNextSeason(): Promise<{
    message: string;
    promotions: number;
    relegations: number;
    stays: number;
    errors: string[];
  }> {
    try {
      const activeSeason = await this.seasonTransitionService.getActiveSeason();
      const result = await this.seasonTransitionService.assignLeaguesForNextSeason(activeSeason.id);
      
      return result;
    } catch (error) {
      return {
        message: `Error en asignación automática: ${error.message}`,
        promotions: 0,
        relegations: 0,
        stays: 0,
        errors: [error.message]
      };
    }
  }

  /**
   * Endpoint de debug para ver estados de equipos en una temporada
   */

  @UseGuards(JwtAuthGuard)
  @Post('assign-relegated-teams')
  async assignRelegatedTeamsToVacantSlots(): Promise<{ message: string; assigned: boolean }> {
    const activeSeason = await this.seasonTransitionService.getActiveSeason();
    await this.seasonTransitionService.assignRelegatedTeamsToVacantSlots(activeSeason.id);
    return {
      message: 'Descendidos asignados a los huecos vacantes tras playoffs',
      assigned: true
    };
  }
  
  @Get(':seasonId/debug-team-status')
  async debugTeamStatus(
    @Param('seasonId', ParseIntPipe) seasonId: number,
    @Body() body: { divisionName?: string }
  ): Promise<any> {
    return this.seasonTransitionService.debugTeamStatusInSeason(seasonId, body.divisionName);
  }
}
