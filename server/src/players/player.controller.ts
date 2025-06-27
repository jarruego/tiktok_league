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
import { getEnabledCompetitions, getCompetitionById, getConfigInfo, getSyncConfig } from '../config/competitions.config';

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
  @UseGuards(JwtAuthGuard)
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

  // Endpoint para obtener TODOS los jugadores de una competición desde cache
  @UseGuards(JwtAuthGuard)
  @Get('cache/competition/:competitionId/players')
  async getAllCachedCompetitionPlayers(
    @Param('competitionId', ParseIntPipe) competitionId: number
  ) {
    // Obtener datos desde el cache
    const cachedData = await this.footballDataCacheService.getCachedCompetition(competitionId);
    
    // Extraer todos los jugadores de todos los equipos
    const allPlayers: any[] = [];
    
    cachedData.competition.teams.forEach(team => {
      if (team.squad && team.squad.length > 0) {
        team.squad.forEach(player => {
          allPlayers.push({
            // Datos del jugador
            footballDataId: player.id,
            name: player.name,
            position: player.position,
            dateOfBirth: player.dateOfBirth,
            nationality: player.nationality,
            shirtNumber: player.shirtNumber,
            role: player.role,
            
            // Datos del equipo al que pertenece
            team: {
              footballDataId: team.id,
              name: team.name,
              shortName: team.shortName,
              crest: team.crest,
              venue: team.venue
            }
          });
        });
      }
    });

    // Estadísticas por posición
    const positionStats = allPlayers.reduce((stats, player) => {
      const position = player.position || 'Unknown';
      stats[position] = (stats[position] || 0) + 1;
      return stats;
    }, {});

    // Estadísticas por nacionalidad (top 10)
    const nationalityStats = allPlayers.reduce((stats, player) => {
      const nationality = player.nationality || 'Unknown';
      stats[nationality] = (stats[nationality] || 0) + 1;
      return stats;
    }, {});

    const topNationalities = Object.entries(nationalityStats)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10)
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});

    // Estadísticas por equipo
    const teamStats = cachedData.competition.teams.map(team => ({
      footballDataId: team.id,
      name: team.name,
      shortName: team.shortName,
      playersCount: team.squad?.length || 0,
      crest: team.crest
    })).sort((a, b) => b.playersCount - a.playersCount);

    return {
      cached: true,
      lastUpdated: cachedData.lastUpdated,
      competition: cachedData.competition.competition,
      season: cachedData.competition.season,
      
      // Resumen
      summary: {
        totalPlayers: allPlayers.length,
        totalTeams: cachedData.competition.teams.length,
        averagePlayersPerTeam: Math.round(allPlayers.length / cachedData.competition.teams.length),
      },
      
      // Estadísticas
      statistics: {
        byPosition: positionStats,
        topNationalities: topNationalities,
        byTeam: teamStats
      },
      
      // Todos los jugadores
      players: allPlayers
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

  // Endpoint para sincronizar un equipo específico (detectar altas y bajas)
  @UseGuards(JwtAuthGuard)
  @Post('sync/team/:teamId')
  async syncTeamFromCache(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() body: { 
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
    
    // 3. Ejecutar sincronización completa (nueva lógica)
    return this.playerService.importFromFootballData(teamData, {
      teamId: teamId,
      footballDataTeamId: body.footballDataTeamId,
      competitionId: body.competitionId,
      source: `manual-sync-${body.competitionId}`
    });
  }

  // Endpoint para sincronizar TODOS los equipos con configuración de Football-Data
  @UseGuards(JwtAuthGuard)
  @Post('sync/all-teams')
  async syncAllTeamsFromCache(@Body() body: { competitionId: number }) {
    // 1. Obtener equipos que tienen configuración de Football-Data
    const teamsWithConfig = await this.playerService.getTeamsWithFootballDataConfig();
    
    if (teamsWithConfig.length === 0) {
      return {
        success: true,
        message: 'No se encontraron equipos con configuración de Football-Data',
        processed: 0,
        results: []
      };
    }

    // 2. Obtener datos desde el cache
    const cachedData = await this.footballDataCacheService.getCachedCompetition(body.competitionId);
    
    // 3. Procesar cada equipo
    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const team of teamsWithConfig) {
      try {
        // Verificar que el equipo tenga footballDataId válido
        if (!team.footballDataId) {
          results.push({
            teamId: team.id,
            teamName: team.name,
            footballDataId: team.footballDataId,
            status: 'error',
            message: `Equipo no tiene footballDataId configurado`
          });
          errorCount++;
          continue;
        }

        // Buscar datos del equipo en el cache
        const teamData = cachedData.competition.teams.find(t => t.id === team.footballDataId);
        
        if (!teamData) {
          results.push({
            teamId: team.id,
            teamName: team.name,
            footballDataId: team.footballDataId,
            status: 'error',
            message: `Equipo no encontrado en cache de competición ${body.competitionId}`
          });
          errorCount++;
          continue;
        }

        // Ejecutar sincronización
        const syncResult = await this.playerService.importFromFootballData(teamData, {
          teamId: team.id,
          footballDataTeamId: team.footballDataId,
          competitionId: body.competitionId,
          source: `bulk-sync-${body.competitionId}`
        });

        results.push({
          teamId: team.id,
          teamName: team.name,
          footballDataId: team.footballDataId,
          status: 'success',
          message: `Sincronizado exitosamente`,
          details: {
            added: syncResult.synchronization.summary.added,
            updated: syncResult.synchronization.summary.updated,
            departed: syncResult.synchronization.summary.departed,
            unchanged: syncResult.synchronization.summary.unchanged,
            total: syncResult.synchronization.summary.total
          }
        });
        successCount++;
        
      } catch (error) {
        results.push({
          teamId: team.id,
          teamName: team.name,
          footballDataId: team.footballDataId,
          status: 'error',
          message: error.message || 'Error desconocido'
        });
        errorCount++;
      }
    }

    return {
      success: true,
      message: `Sincronización masiva completada`,
      processed: teamsWithConfig.length,
      successCount,
      errorCount,
      competitionId: body.competitionId,
      lastUpdated: cachedData.lastUpdated,
      results: results
    };
  }

  // Endpoint para obtener equipos que tienen configuración de Football-Data
  @UseGuards(JwtAuthGuard)
  @Get('teams/with-football-data-config')
  async getTeamsWithFootballDataConfig() {
    const teams = await this.playerService.getTeamsWithFootballDataConfig();
    
    return {
      success: true,
      count: teams.length,
      teams: teams.map(team => ({
        id: team.id,
        name: team.name,
        footballDataId: team.footballDataId,
        competitionId: team.competitionId
      }))
    };
  }

  // Endpoint para obtener la configuración de competiciones disponibles
  @UseGuards(JwtAuthGuard)
  @Get('competitions/config')
  async getCompetitionsConfig() {
    const allCompetitions = getEnabledCompetitions();
    const configInfo = getConfigInfo();
    
    return {
      success: true,
      message: 'Configuración de competiciones disponibles',
      configInfo: {
        source: configInfo.source,
        totalAvailable: configInfo.totalAvailable,
        totalEnabled: configInfo.totalEnabled,
        envVariable: configInfo.envVariable
      },
      syncSettings: {
        autoSyncEnabled: configInfo.syncConfig.autoSyncEnabled,
        intervalHours: configInfo.syncConfig.intervalHours,
        maxTeamsPerCompetition: configInfo.syncConfig.maxTeamsPerCompetition,
        defaultCompetitionEnabled: configInfo.syncConfig.defaultCompetitionEnabled
      },
      competitions: allCompetitions.map(comp => ({
        id: comp.id,
        name: comp.name,
        code: comp.code,
        country: comp.country,
        enabled: comp.enabled
      })),
      environmentVariables: {
        ENABLED_COMPETITION_IDS: 'IDs de competiciones habilitadas (ej: 2019,2021,2014)',
        DEFAULT_COMPETITION_ENABLED: 'Habilitar competiciones por defecto (true/false)',
        MAX_TEAMS_PER_COMPETITION: 'Límite de equipos por competición (0 = sin límite)',
        AUTO_SYNC_INTERVAL_HOURS: 'Intervalo de sincronización automática en horas',
        AUTO_SYNC_ALL_ENABLED: 'Habilitar sincronización automática (true/false)'
      },
      notes: [
        'Configuración por defecto: /config/competitions.config.ts',
        'Variables de entorno: Ver environmentVariables arriba',
        'Archivo opcional: .env.competitions'
      ]
    };
  }

  // Endpoint para verificar si la sincronización automática está habilitada
  @UseGuards(JwtAuthGuard)
  @Get('sync/auto-status')
  async getAutoSyncStatus() {
    const syncConfig = getSyncConfig();
    
    return {
      success: true,
      message: 'Estado de la sincronización automática',
      autoSync: {
        enabled: syncConfig.autoSyncEnabled,
        intervalHours: syncConfig.intervalHours,
        nextSyncEstimated: syncConfig.autoSyncEnabled 
          ? new Date(Date.now() + syncConfig.intervalHours * 60 * 60 * 1000).toISOString()
          : null
      },
      limits: {
        maxTeamsPerCompetition: syncConfig.maxTeamsPerCompetition,
        description: syncConfig.maxTeamsPerCompetition === 0 
          ? 'Sin límite de equipos' 
          : `Máximo ${syncConfig.maxTeamsPerCompetition} equipos por competición`
      },
      configuration: {
        source: 'environment variables',
        environmentVariables: {
          AUTO_SYNC_ALL_ENABLED: process.env.AUTO_SYNC_ALL_ENABLED || 'false',
          AUTO_SYNC_INTERVAL_HOURS: process.env.AUTO_SYNC_INTERVAL_HOURS || '24',
          MAX_TEAMS_PER_COMPETITION: process.env.MAX_TEAMS_PER_COMPETITION || '0'
        }
      }
    };
  }

  // Endpoint para sincronizar TODAS las competiciones automáticamente
  @UseGuards(JwtAuthGuard)
  @Post('sync/all-competitions')
  async syncAllCompetitionsFromCache(@Body() body?: { competitionIds?: number[] }) {
    // Obtener competiciones desde configuración
    const defaultCompetitions = getEnabledCompetitions();

    // Usar competiciones especificadas o todas las principales habilitadas
    const competitionsToSync = body?.competitionIds 
      ? body.competitionIds.map(id => {
          const config = getCompetitionById(id);
          return config ? { id: config.id, name: config.name } : { id, name: `Competition ${id}` };
        })
      : defaultCompetitions.map(comp => ({ id: comp.id, name: comp.name }));

    const globalResults = {
      success: true,
      message: 'Sincronización multi-competición completada',
      totalCompetitions: competitionsToSync.length,
      competitionResults: [] as any[],
      globalSummary: {
        totalTeamsProcessed: 0,
        totalSuccessful: 0,
        totalErrors: 0,
        totalPlayersAffected: 0
      }
    };

    // Procesar cada competición
    for (const competition of competitionsToSync) {
      try {
        // Verificar si existe cache para esta competición
        let cachedData;
        try {
          cachedData = await this.footballDataCacheService.getCachedCompetition(competition.id);
        } catch (error) {
          globalResults.competitionResults.push({
            competitionId: competition.id,
            competitionName: competition.name,
            status: 'error',
            message: `No hay cache disponible para esta competición`,
            teamsProcessed: 0,
            successCount: 0,
            errorCount: 0
          });
          continue;
        }

        // Obtener equipos configurados para esta competición
        const teamsWithConfig = await this.playerService.getTeamsWithFootballDataConfig();
        const teamsForThisCompetition = teamsWithConfig.filter(team => team.competitionId === competition.id);

        // Aplicar límite de equipos por competición si está configurado
        const syncConfig = getSyncConfig();
        const maxTeams = syncConfig.maxTeamsPerCompetition;
        const finalTeams = maxTeams > 0 ? teamsForThisCompetition.slice(0, maxTeams) : teamsForThisCompetition;

        if (finalTeams.length === 0) {
          globalResults.competitionResults.push({
            competitionId: competition.id,
            competitionName: competition.name,
            status: 'skipped',
            message: 'No hay equipos configurados para esta competición',
            teamsProcessed: 0,
            successCount: 0,
            errorCount: 0
          });
          continue;
        }

        // Sincronizar equipos de esta competición
        const competitionResults: any[] = [];
        let successCount = 0;
        let errorCount = 0;
        let totalPlayersAffected = 0;

        for (const team of finalTeams) {
          try {
            if (!team.footballDataId) {
              competitionResults.push({
                teamId: team.id,
                teamName: team.name,
                status: 'error',
                message: 'Equipo no tiene footballDataId configurado'
              });
              errorCount++;
              continue;
            }

            // Buscar datos del equipo en el cache
            const teamData = cachedData.competition.teams.find(t => t.id === team.footballDataId);
            
            if (!teamData) {
              competitionResults.push({
                teamId: team.id,
                teamName: team.name,
                status: 'error',
                message: `Equipo no encontrado en cache`
              });
              errorCount++;
              continue;
            }

            // Ejecutar sincronización
            const syncResult = await this.playerService.importFromFootballData(teamData, {
              teamId: team.id,
              footballDataTeamId: team.footballDataId,
              competitionId: competition.id,
              source: `multi-comp-sync-${competition.id}`
            });

            const playersAffected = syncResult.synchronization.summary.added + 
                                   syncResult.synchronization.summary.updated + 
                                   syncResult.synchronization.summary.departed;
            
            totalPlayersAffected += playersAffected;

            competitionResults.push({
              teamId: team.id,
              teamName: team.name,
              status: 'success',
              message: 'Sincronizado exitosamente',
              details: {
                added: syncResult.synchronization.summary.added,
                updated: syncResult.synchronization.summary.updated,
                departed: syncResult.synchronization.summary.departed,
                unchanged: syncResult.synchronization.summary.unchanged,
                total: syncResult.synchronization.summary.total
              }
            });
            successCount++;
            
          } catch (error) {
            competitionResults.push({
              teamId: team.id,
              teamName: team.name,
              status: 'error',
              message: error.message || 'Error desconocido'
            });
            errorCount++;
          }
        }

        // Agregar resultado de esta competición
        globalResults.competitionResults.push({
          competitionId: competition.id,
          competitionName: competition.name,
          status: successCount > 0 ? 'success' : 'error',
          message: `${successCount} equipos sincronizados, ${errorCount} errores`,
          teamsProcessed: finalTeams.length,
          teamsAvailable: teamsForThisCompetition.length,
          teamsLimitApplied: maxTeams > 0 && teamsForThisCompetition.length > maxTeams,
          successCount,
          errorCount,
          playersAffected: totalPlayersAffected,
          lastUpdated: cachedData.lastUpdated,
          teamResults: competitionResults
        });

        // Actualizar resumen global
        globalResults.globalSummary.totalTeamsProcessed += finalTeams.length;
        globalResults.globalSummary.totalSuccessful += successCount;
        globalResults.globalSummary.totalErrors += errorCount;
        globalResults.globalSummary.totalPlayersAffected += totalPlayersAffected;

      } catch (error) {
        globalResults.competitionResults.push({
          competitionId: competition.id,
          competitionName: competition.name,
          status: 'error',
          message: `Error procesando competición: ${error.message}`,
          teamsProcessed: 0,
          successCount: 0,
          errorCount: 0
        });
      }
    }

    return globalResults;
  }
}
