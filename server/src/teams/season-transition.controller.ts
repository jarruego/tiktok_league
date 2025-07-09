import { Controller, Post, Body, Param, Get, UseGuards, ParseIntPipe } from '@nestjs/common';
import { SeasonTransitionService, SeasonTransitionResult, PlayoffMatchup } from './season-transition.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('season-transition')
export class SeasonTransitionController {
  constructor(
    private readonly seasonTransitionService: SeasonTransitionService
  ) {}

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
   * Generar reporte de estado de cierre de temporada
   */
  @UseGuards(JwtAuthGuard)
  @Get(':seasonId/closure-report')
  async getSeasonClosureReport(
    @Param('seasonId', ParseIntPipe) seasonId: number
  ): Promise<any> {
    return this.seasonTransitionService.generateSeasonClosureReport(seasonId);
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
}
