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

  // Endpoint para verificar el estado de rate limiting
  @Get('rate-limit-status')
  getRateLimitStatus() {
    return {
      configured: this.footballDataService.isConfigured(),
      rateLimiting: {
        minIntervalMs: 12000,
        recommendations: {
          freeApiRequests: '10 per minute',
          recommendedDelay: '12-15 seconds between requests',
          bulkOperations: 'Use with caution, monitor for 429 errors'
        }
      },
      lastKnownLimits: {
        dailyRequests: 'Unknown (check Football-Data.org documentation)',
        monthlyRequests: 'Unknown (check Football-Data.org documentation)',
        note: 'Free tier has restricted access to competitions'
      },
      currentTime: new Date(),
      message: 'Use /football-data/cache/all-competitions with caution due to rate limits'
    };
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
  @UseGuards(JwtAuthGuard)
  @Get('cache/competition/:id')
  async getCachedCompetition(@Param('id', ParseIntPipe) id: number) {
    return this.footballDataCacheService.getCachedCompetition(id);
  }

  // Listar todas las competiciones cacheadas
  @UseGuards(JwtAuthGuard)
  @Get('cache/competitions')
  async listCachedCompetitions() {
    return this.footballDataCacheService.listCachedCompetitions();
  }

  // Ver competiciones principales disponibles
  @UseGuards(JwtAuthGuard)
  @Get('competitions/available')
  getAvailableCompetitions() {
    return this.footballDataCacheService.getMainCompetitions();
  }

  // Endpoint: Listar todas las ligas y equipos (con sus ids)
  @UseGuards(JwtAuthGuard)
  @Get('cache/leagues-with-teams')
  async getLeaguesWithTeams() {
    // 1. Obtener todas las ligas cacheadas
    const cached = await this.footballDataCacheService.listCachedCompetitions();
    const competitions = cached.competitions || [];

    // 2. Para cada liga, obtener los equipos desde el cache detallado
    const result: any[] = [];
    for (const comp of competitions) {
      try {
        const detail = await this.footballDataCacheService.getCachedCompetition(comp.competitionId);
        const raw = detail.competition;
        result.push({
          competitionId: comp.competitionId,
          competitionName: comp.competitionName,
          competitionCode: comp.competitionCode,
          season: comp.season,
          teams: Array.isArray(raw.teams)
            ? raw.teams.map(team => ({
                footballId: team.id,
                name: team.name,
                shortName: team.shortName,
                crest: team.crest,
                playersCount: Array.isArray(team.squad) ? team.squad.length : 0,
              }))
            : [],
        });
      } catch (e) {
        // Si falla una liga, la saltamos
      }
    }
    return { total: result.length, leagues: result };
  }

  // === CRON & MANTENIMIENTO ===
  
  // Forzar actualización del cache (útil para testing o actualizaciones manuales)
  @UseGuards(JwtAuthGuard)
  @Post('cache/force-update')
  async forceCacheUpdate() {
    return this.footballDataCacheService.forceCacheUpdate();
  }

  @UseGuards(JwtAuthGuard)
  @Get('remote-team/:id')
  async getRemoteTeamSquadCount(@Param('id', ParseIntPipe) id: number) {
    const team = await this.footballDataService.getTeam(id);
    return {
      footballDataId: team.id,
      name: team.name,
      squadCount: Array.isArray(team.squad) ? team.squad.length : 0
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('remote-competition/:id/players-count')
  async getRemoteCompetitionPlayersCount(@Param('id', ParseIntPipe) id: number) {
    const data = await this.footballDataService.getCompetitionTeams(id);
    // Football-Data API v4: cada equipo trae un array squad[]
    let total = 0;
    if (Array.isArray(data.teams)) {
      for (const team of data.teams) {
        if (Array.isArray(team.squad)) total += team.squad.length;
      }
    }
    return {
      competitionId: id,
      totalPlayers: total,
      teams: Array.isArray(data.teams) ? data.teams.length : 0
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('remote-competition/:id/import')
  async importRemoteCompetitionToCache(@Param('id', ParseIntPipe) id: number) {
    // Traer datos remotos
    const data = await this.footballDataService.getCompetitionTeams(id);
    // Guardar en cache usando el servicio de cache
    const result = await this.footballDataCacheService.cacheCompetition(id);
    return {
      message: 'Importación desde API remota completada',
      competitionId: id,
      cacheResult: result
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('remote-competitions')
  async getRemoteCompetitions() {
    // Llama al endpoint remoto de competiciones
    const url = `${this.footballDataService["apiUrl"]}/competitions`;
    const response = await fetch(url, { headers: this.footballDataService["getHeaders"]() });
    if (!response.ok) throw new Error('Error al consultar competiciones remotas');
    const data = await response.json();
    // Devuelve solo id y nombre para cada competición
    return Array.isArray(data.competitions)
      ? data.competitions.map((c:any) => ({ id: c.id, name: c.name, code: c.code, area: c.area?.name }))
      : [];
  }

  // Cachear competiciones de forma segura (una por vez)
  @UseGuards(JwtAuthGuard)
  @Post('cache/safe-single')
  async cacheSingleCompetitionSafely() {
    return this.footballDataCacheService.cacheCompetitionsSafely();
  }
}
