import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Patch, 
  Delete, 
  UseGuards, 
  Query,
  ParseIntPipe,
  ValidationPipe
} from '@nestjs/common';
import { PlayerService } from './player.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { GetPlayersQueryDto } from './dto/get-players-query.dto';
import { ImportPlayersDto } from './dto/import-players.dto';
import { FootballDataCacheService } from '../football-data/football-data-cache.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('players')
export class PlayerController {
  constructor(
    private readonly playerService: PlayerService,
    private readonly footballDataCacheService: FootballDataCacheService,
  ) {}

  // Solo usuarios autenticados pueden crear, actualizar o borrar jugadores
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createPlayerDto: CreatePlayerDto) {
    return this.playerService.create(createPlayerDto);
  }

  // Endpoint para crear múltiples jugadores (útil para APIs externas)
  @UseGuards(JwtAuthGuard)
  @Post('bulk')
  createMany(@Body() createPlayersDto: CreatePlayerDto[]) {
    return this.playerService.createMany(createPlayersDto);
  }

  // Endpoint específico para importar desde APIs externas
  @UseGuards(JwtAuthGuard)
  @Post('import')
  importFromExternal(@Body() importPlayersDto: ImportPlayersDto) {
    return this.playerService.importPlayersFromExternal(importPlayersDto);
  }

  // NUEVO: Importar desde cache local
  @UseGuards(JwtAuthGuard)
  @Post('import/from-cache')
  async importFromCache(
    @Body() body: { 
      teamId: number; 
      footballDataTeamId: number; 
      competitionId: number; 
    }
  ) {
    // 1. Obtener datos desde el cache local
    const cachedData = await this.footballDataCacheService.getCachedCompetition(body.competitionId);
    
    // 2. Buscar el equipo específico en los datos cacheados
    const teams = cachedData.competition.teams;
    const teamData = teams.find(team => team.id === body.footballDataTeamId);
    
    if (!teamData) {
      throw new Error(`Team with Football-Data ID ${body.footballDataTeamId} not found in cached competition ${body.competitionId}`);
    }
    
    // 3. Importar usando el servicio existente
    return this.playerService.importFromFootballData(teamData, {
      teamId: body.teamId,
      footballDataTeamId: body.footballDataTeamId,
      competitionId: body.competitionId, // Añadir competitionId
      source: `cache-competition-${body.competitionId}`
    });
  }

  // Endpoint para listar equipos disponibles en una competición cacheada
  @Get('cache/competition/:competitionId/teams')
  async getCachedCompetitionTeams(
    @Param('competitionId', ParseIntPipe) competitionId: number
  ) {
    // Obtener datos desde el cache
    const cachedData = await this.footballDataCacheService.getCachedCompetition(competitionId);
    
    const teams = cachedData.competition.teams.map(team => ({
      footballDataId: team.id,
      name: team.name,
      shortName: team.shortName,
      venue: team.venue,
      founded: team.founded,
      playersCount: team.squad?.length || 0,
      hasCoach: !!team.coach?.name,
      crest: team.crest,
      website: team.website
    }));
    
    return {
      cached: true,
      lastUpdated: cachedData.lastUpdated,
      competition: cachedData.competition.competition,
      season: cachedData.competition.season,
      teamsCount: teams.length,
      teams,
      instruction: 'Para importar: POST /players/import/from-cache con { teamId: TU_EQUIPO_ID, footballDataTeamId: FOOTBALL_DATA_ID, competitionId: COMPETITION_ID }'
    };
  }

  @Get()
  findAll(@Query(new ValidationPipe({ transform: true })) query: GetPlayersQueryDto) {
    return this.playerService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.playerService.findOne(id);
  }

  // Endpoint específico para obtener jugadores de un equipo
  @Get('team/:teamId')
  findByTeam(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.playerService.findByTeam(teamId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updatePlayerDto: UpdatePlayerDto
  ) {
    return this.playerService.update(id, updatePlayerDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.playerService.remove(id);
  }
}
