
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query, 
  UseGuards,
  ParseIntPipe,
  ValidationPipe,
  NotFoundException
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { matchPlayerStatsTable, playerTable, matchTable, teamTable, leagueTable, divisionTable } from '../database/schema';
import { MatchService } from './match.service';
import { MatchSimulationService, MatchSimulationResult } from './match-simulation.service';
import { StandingsService } from '../standings/standings.service';
import { SeasonTransitionService } from '../teams/season-transition.service';
import { CreateMatchDto, GenerateMatchesDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { GetMatchesQueryDto } from './dto/get-matches-query.dto';
import { SimulateMatchesByDateDto, SimulateSingleMatchDto, SimulateMatchesQueryDto } from './dto/simulate-match.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('matches')
export class MatchController {
  constructor(
    private readonly matchService: MatchService,
    private readonly matchSimulationService: MatchSimulationService,
    private readonly standingsService: StandingsService,
    private readonly seasonTransitionService: SeasonTransitionService
  ) {}

  /**
   * Generar todos los partidos para una temporada
   * Solo administradores pueden generar partidos
   */
  @UseGuards(JwtAuthGuard)
  @Post('generate')
  async generateMatches(@Body() generateMatchesDto: GenerateMatchesDto) {
    return this.matchService.generateMatches(generateMatchesDto);
  }

  /**
   * Crear un partido individual
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() createMatchDto: CreateMatchDto) {
    return this.matchService.create(createMatchDto);
  }

  /**
   * Obtener partidos con filtros y paginación
   */
  @Get()
  async findAll(@Query(ValidationPipe) query: GetMatchesQueryDto) {
    return this.matchService.findMany(query);
  }

  /**
   * Obtener partidos por temporada (endpoint simplificado)
   */
  @Get('season/:seasonId')
  async findBySeason(
    @Param('seasonId', ParseIntPipe) seasonId: number,
    @Query(ValidationPipe) query: Omit<GetMatchesQueryDto, 'seasonId'>
  ) {
    return this.matchService.findMany({ ...query, seasonId });
  }

  /**
   * Obtener partidos por liga
   */
  @Get('league/:leagueId')
  async findByLeague(
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Query(ValidationPipe) query: Omit<GetMatchesQueryDto, 'leagueId'>
  ) {
    return this.matchService.findMany({ ...query, leagueId });
  }

  /**
   * Obtener partidos por equipo
   */
  @Get('team/:teamId')
  async findByTeam(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Query(ValidationPipe) query: Omit<GetMatchesQueryDto, 'teamId'>
  ) {
    return this.matchService.findMany({ ...query, teamId });
  }

  /**
   * Obtener un partido específico
   */


// ...resto de la clase...

  /**
   * Detalle de partido: resultado y estadísticas de jugadores (goles y asistencias)
   */
  @Get(':id/detail')
  async getMatchDetail(@Param('id', ParseIntPipe) id: number) {
    // Obtener partido con info de equipos (igual que en findMany)
    const db = this.matchService['databaseService'].db;
    const [matchRow] = await db
      .select({
        id: matchTable.id,
        matchday: matchTable.matchday,
        scheduledDate: matchTable.scheduledDate,
        status: matchTable.status,
        homeGoals: matchTable.homeGoals,
        awayGoals: matchTable.awayGoals,
        notes: matchTable.notes,
        isPlayoff: matchTable.isPlayoff,
        playoffRound: matchTable.playoffRound,
        homeTeamId: matchTable.homeTeamId,
        awayTeamId: matchTable.awayTeamId,
        leagueId: matchTable.leagueId
      })
      .from(matchTable)
      .where(eq(matchTable.id, id));

    if (!matchRow) throw new NotFoundException('Partido no encontrado');

    // Obtener info de equipos (incluyendo colores personalizados)
    const [homeTeam, awayTeam] = await Promise.all([
      db.select({
        id: teamTable.id,
        name: teamTable.name,
        shortName: teamTable.shortName,
        crest: teamTable.crest,
        primaryColor: teamTable.primaryColor,
        secondaryColor: teamTable.secondaryColor
      })
        .from(teamTable).where(eq(teamTable.id, matchRow.homeTeamId)),
      db.select({
        id: teamTable.id,
        name: teamTable.name,
        shortName: teamTable.shortName,
        crest: teamTable.crest,
        primaryColor: teamTable.primaryColor,
        secondaryColor: teamTable.secondaryColor
      })
        .from(teamTable).where(eq(teamTable.id, matchRow.awayTeamId))
    ]);

    // Obtener info de liga y división
    const [league] = await db.select({ id: leagueTable.id, name: leagueTable.name, groupCode: leagueTable.groupCode, divisionId: leagueTable.divisionId })
      .from(leagueTable).where(eq(leagueTable.id, matchRow.leagueId));
    const [division] = league
      ? await db.select({ id: divisionTable.id, name: divisionTable.name, level: divisionTable.level })
          .from(divisionTable).where(eq(divisionTable.id, league.divisionId))
      : [null];

    const match = {
      ...matchRow,
      homeTeam: homeTeam[0] || { id: matchRow.homeTeamId, name: 'Unknown', shortName: null, crest: null, primaryColor: null, secondaryColor: null },
      awayTeam: awayTeam[0] || { id: matchRow.awayTeamId, name: 'Unknown', shortName: null, crest: null, primaryColor: null, secondaryColor: null },
      league: league || { id: matchRow.leagueId, name: 'Unknown', groupCode: '', divisionId: null },
      division: division || { id: null, name: '', level: null }
    };

    // Obtener stats de jugadores para este partido
    const stats = await db
      .select({
        playerId: matchPlayerStatsTable.playerId,
        teamId: matchPlayerStatsTable.teamId,
        goals: matchPlayerStatsTable.goals,
        assists: matchPlayerStatsTable.assists,
        goalMinutes: matchPlayerStatsTable.goalMinutes,
        playerName: playerTable.name
      })
      .from(matchPlayerStatsTable)
      .innerJoin(playerTable, eq(matchPlayerStatsTable.playerId, playerTable.id))
      .where(eq(matchPlayerStatsTable.matchId, id));

    // Separar por equipo local y visitante
    const homeStats = stats.filter(s => s.teamId === match.homeTeam.id);
    const awayStats = stats.filter(s => s.teamId === match.awayTeam.id);

    // Formato compatible con el frontend
    return {
      match,
      homeStats,
      awayStats
    };
  }
  // ==========================================
  // ENDPOINTS DE SIMULACIÓN DE PARTIDOS
  // ==========================================

  /**
   * Simular partidos de una fecha específica
   */
  @UseGuards(JwtAuthGuard)
  @Post('simulate/date')
  async simulateMatchesByDate(@Body() simulateDto: SimulateMatchesByDateDto): Promise<MatchSimulationResult[]> {
    return this.matchSimulationService.simulateMatchesByDate(simulateDto.date);
  }

  /**
   * Simular un partido específico por ID
   */
  @UseGuards(JwtAuthGuard)
  @Post('simulate/:matchId')
  async simulateSingleMatch(@Param('matchId', ParseIntPipe) matchId: number): Promise<MatchSimulationResult> {
    return this.matchSimulationService.simulateSingleMatch(matchId);
  }

  /**
   * Simular todos los partidos pendientes
   * ⚠️ Usar con precaución - simula TODOS los partidos programados
   */
  @UseGuards(JwtAuthGuard)
  @Get('simulate/all')
  async simulateAllPendingMatches(): Promise<MatchSimulationResult[]> {
    // Log eliminado
    return this.matchSimulationService.simulateAllPendingMatches();
  }

  /**
   * Obtener estadísticas de simulación
   */
  @Get('simulation/stats')
  async getSimulationStats() {
    return this.matchSimulationService.getSimulationStats();
  }

  /**
   * Simular partidos en un rango de fechas (recuperación manual)
   */
  @UseGuards(JwtAuthGuard)
  @Post('simulate/date-range')
  async simulatePendingMatchesInRange(@Body() simulateDto: { startDate: string, endDate: string }): Promise<MatchSimulationResult[]> {
    const startDate = new Date(simulateDto.startDate + 'T00:00:00.000Z');
    const endDate = new Date(simulateDto.endDate + 'T23:59:59.999Z');
    
    return this.matchSimulationService.simulatePendingMatchesInRange(startDate, endDate);
  }

  // ==========================================
  // ENDPOINTS DE CLASIFICACIONES
  // ==========================================

  /**
   * Obtener clasificación de una liga específica
   */
  @Get('standings/league/:leagueId/season/:seasonId')
  async getLeagueStandings(
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Param('seasonId', ParseIntPipe) seasonId: number
  ) {
    return this.standingsService.getLeagueStandings(seasonId, leagueId);
}

  /**
   * Obtener todas las clasificaciones de una temporada
   */
  @Get('standings/season/:seasonId')
  async getAllStandingsForSeason(@Param('seasonId', ParseIntPipe) seasonId: number) {
    return this.standingsService.getAllStandingsForSeason(seasonId);
  }

  /**
   * Recalcular clasificaciones para una temporada
   */
  @UseGuards(JwtAuthGuard)
  @Post('standings/recalculate/season/:seasonId')
  async recalculateStandingsForSeason(@Param('seasonId', ParseIntPipe) seasonId: number) {
    await this.standingsService.recalculateStandingsForSeason(seasonId);
    return { message: 'Clasificaciones recalculadas exitosamente' };
  }

  /**
   * Recalcular clasificaciones para una liga específica
   */
  @UseGuards(JwtAuthGuard)
  @Post('standings/recalculate/league/:leagueId/season/:seasonId')
  async recalculateStandingsForLeague(
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Param('seasonId', ParseIntPipe) seasonId: number
  ) {
    await this.standingsService.recalculateStandingsForLeague(seasonId, leagueId);
    return { message: 'Clasificación de liga recalculada exitosamente' };
  }

  /**
   * Debug: Verificar estados de equipos en una temporada
   */
  @UseGuards(JwtAuthGuard)
  @Get('debug/team-status/season/:seasonId')
  async debugTeamStatus(
    @Param('seasonId', ParseIntPipe) seasonId: number,
    @Query('division') division?: string
  ) {
    await this.seasonTransitionService.debugTeamStatusInSeason(seasonId, division);
    return { message: 'Debug de estados de equipos completado. Revisar logs del servidor.' };
  }
}
