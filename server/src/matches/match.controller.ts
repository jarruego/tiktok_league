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
import { CreateMatchDto, GenerateMatchesDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { GetMatchesQueryDto } from './dto/get-matches-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('matches')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

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
}
