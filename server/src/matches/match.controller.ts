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
  ValidationPipe
} from '@nestjs/common';
import { MatchService } from './match.service';
import { MatchSimulationService, MatchSimulationResult } from './match-simulation.service';
import { StandingsService } from './standings.service';
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
    private readonly standingsService: StandingsService
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
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.matchService.findOne(id);
  }

  /**
   * Actualizar un partido
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMatchDto: UpdateMatchDto
  ) {
    return this.matchService.update(id, updateMatchDto);
  }

  /**
   * Eliminar un partido
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.matchService.remove(id);
  }

  /**
   * Eliminar todos los partidos de una temporada
   * Útil para regenerar el calendario
   */
  @UseGuards(JwtAuthGuard)
  @Delete('season/:seasonId')
  async removeAllBySeason(@Param('seasonId', ParseIntPipe) seasonId: number) {
    return this.matchService.removeAllBySeason(seasonId);
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
  @Post('simulate/all')
  async simulateAllPendingMatches(): Promise<MatchSimulationResult[]> {
    return this.matchSimulationService.simulateAllPendingMatches();
  }

  /**
   * Obtener estadísticas de simulación
   */
  @Get('simulation/stats')
  async getSimulationStats() {
    return this.matchSimulationService.getSimulationStats();
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
   * ENDPOINT TEMPORAL PARA TESTING - ELIMINAR EN PRODUCCIÓN
   * Probar el algoritmo Round Robin sin necesidad de autenticación
   */
  @Get('debug/test-round-robin')
  async testRoundRobin() {
    return this.matchService.testRoundRobinAlgorithm();
  }
}
