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
import { FootballDataTeamResponseDto, ImportTeamFromFootballDataDto } from './dto/football-data.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('players')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

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

  // Endpoint específico para Football-Data.org
  @UseGuards(JwtAuthGuard)
  @Post('import/football-data')
  importFromFootballData(
    @Body() body: { teamData: FootballDataTeamResponseDto; importDto: ImportTeamFromFootballDataDto }
  ) {
    return this.playerService.importFromFootballData(body.teamData, body.importDto);
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
