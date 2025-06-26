import { Controller, Get, Param, ParseIntPipe, UseGuards, Post } from '@nestjs/common';
import { FootballDataService } from './football-data.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FootballDataCacheService } from './football-data-cache.service';

@Controller('football-data')
export class FootballDataController {
  constructor(
    private readonly footballDataService: FootballDataService,
    private readonly footballDataCacheService: FootballDataCacheService,
  ) {}

  @Get('info')
  getApiInfo() {
    return this.footballDataService.getApiInfo();
  }

  @UseGuards(JwtAuthGuard)
  @Get('teams/:id')
  async getTeam(@Param('id', ParseIntPipe) id: number) {
    return this.footballDataService.getTeam(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('competitions/:id')
  async getCompetition(@Param('id', ParseIntPipe) id: number) {
    return this.footballDataService.getCompetition(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('competitions/:id/teams')
  async getCompetitionTeams(@Param('id', ParseIntPipe) id: number) {
    return this.footballDataService.getCompetitionTeams(id);
  }

  // === ENDPOINTS DE CACHE ===
  
  // Cachear una competición específica
  @UseGuards(JwtAuthGuard)
  @Post('cache/competition/:id')
  async cacheCompetition(@Param('id', ParseIntPipe) id: number) {
    return this.footballDataCacheService.cacheCompetition(id);
  }

  // Cachear todas las competiciones principales
  @UseGuards(JwtAuthGuard)
  @Post('cache/all-competitions')
  async cacheAllCompetitions() {
    return this.footballDataCacheService.cacheAllMainCompetitions();
  }

  // Obtener datos cacheados de una competición
  @Get('cache/competition/:id')
  async getCachedCompetition(@Param('id', ParseIntPipe) id: number) {
    return this.footballDataCacheService.getCachedCompetition(id);
  }

  // Listar todas las competiciones cacheadas
  @Get('cache/competitions')
  async listCachedCompetitions() {
    return this.footballDataCacheService.listCachedCompetitions();
  }

  // Ver competiciones principales disponibles
  @Get('competitions/available')
  getAvailableCompetitions() {
    return this.footballDataCacheService.getMainCompetitions();
  }

  // === CRON & MANTENIMIENTO ===
  
  // Forzar actualización del cache (útil para testing o actualizaciones manuales)
  @UseGuards(JwtAuthGuard)
  @Post('cache/force-update')
  async forceCacheUpdate() {
    return this.footballDataCacheService.forceCacheUpdate();
  }
}
