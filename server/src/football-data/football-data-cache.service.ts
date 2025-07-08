import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { footballDataCacheTable } from '../database/schema';
import { eq, desc } from 'drizzle-orm';
import { FootballDataService } from './football-data.service';
import { DATABASE_PROVIDER } from '../database/database.module';

@Injectable()
export class FootballDataCacheService {
  private readonly logger = new Logger(FootballDataCacheService.name);

  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
    private readonly footballDataService: FootballDataService,
  ) {}

  // Competiciones principales con sus IDs
  private readonly MAIN_COMPETITIONS = {
    'Premier League': 2021,
    'La Liga': 2014,
    'Bundesliga': 2002,
    'Serie A': 2019,
    'Ligue 1': 2015,
    'Primeira Liga': 2017,
    'Eredivisie': 2003,
    'Championship': 2016,
  };

  // Cachear una competición específica
  async cacheCompetition(competitionId: number): Promise<any> {
    const db = this.databaseService.db;
    
    try {
      console.log(`🔄 Caching competition ${competitionId}...`);
      
      // 1. Obtener datos de la API
      const competitionData = await this.footballDataService.getCompetitionTeams(competitionId);
      
      // 2. Verificar si ya existe cache para esta competición
      const [existingCache] = await db
        .select()
        .from(footballDataCacheTable)
        .where(eq(footballDataCacheTable.competitionId, competitionId))
        .orderBy(desc(footballDataCacheTable.createdAt))
        .limit(1);

      // 3. Preparar datos para guardar
      const cacheData = {
        competitionId: competitionId,
        competitionName: competitionData.competition.name,
        competitionCode: competitionData.competition.code,
        rawData: competitionData,
        season: competitionData.season?.id?.toString() || new Date().getFullYear().toString(),
        teamsCount: competitionData.count || competitionData.teams?.length || 0,
        lastUpdated: new Date(),
        isActive: true,
      };

      let result;
      if (existingCache) {
        // Actualizar cache existente
        [result] = await db
          .update(footballDataCacheTable)
          .set({ ...cacheData, updatedAt: new Date() })
          .where(eq(footballDataCacheTable.id, existingCache.id))
          .returning();
        
        console.log(`✅ Updated cache for ${competitionData.competition.name}`);
      } else {
        // Crear nuevo cache
        [result] = await db
          .insert(footballDataCacheTable)
          .values(cacheData)
          .returning();
        
        console.log(`✅ Created cache for ${competitionData.competition.name}`);
      }

      return {
        cached: true,
        competition: competitionData.competition.name,
        teams: competitionData.count,
        season: competitionData.season,
        cacheId: result.id,
        message: `Successfully cached ${competitionData.competition.name} with ${competitionData.count} teams`
      };

    } catch (error) {
      console.error(`❌ Failed to cache competition ${competitionId}:`, error.message);
      throw new Error(`Failed to cache competition: ${error.message}`);
    }
  }

  // Cachear todas las competiciones principales
  async cacheAllMainCompetitions(): Promise<any> {
    const results: any[] = [];
    
    for (const [name, id] of Object.entries(this.MAIN_COMPETITIONS)) {
      try {
        console.log(`🔄 Processing ${name}...`);
        const result = await this.cacheCompetition(id);
        results.push({ name, success: true, ...result });
        
        // Esperar 15 segundos entre requests para respetar límites de API gratuita
        console.log(`⏱️ Waiting 15 seconds before next competition request...`);
        await new Promise(resolve => setTimeout(resolve, 15000));
        
      } catch (error) {
        console.error(`❌ Failed to cache ${name}:`, error.message);
        results.push({ 
          name, 
          success: false, 
          error: error.message,
          competitionId: id 
        });
        
        // Si falla por rate limit, esperar más tiempo
        if (error.message.includes('429') || error.message.includes('Rate limit')) {
          console.log(`🚫 Rate limit detected, waiting 60 seconds before continuing...`);
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      }
    }

    return {
      message: 'Bulk caching completed',
      total: Object.keys(this.MAIN_COMPETITIONS).length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  // Obtener datos cacheados de una competición  
  async getCachedCompetition(competitionId: number): Promise<any> {
    const db = this.databaseService.db;
    
    const cached = await db
      .select()
      .from(footballDataCacheTable)
      .where(
        eq(footballDataCacheTable.competitionId, competitionId)
      )
      .orderBy(desc(footballDataCacheTable.lastUpdated))
      .limit(1);

    const [result] = cached.filter(c => c.isActive);

    if (!result) {
      throw new Error(`No cached data found for competition ${competitionId}`);
    }

    return {
      cached: true,
      lastUpdated: result.lastUpdated,
      competition: result.rawData,
      cacheInfo: {
        id: result.id,
        competitionName: result.competitionName,
        season: result.season,
        teamsCount: result.teamsCount,
        lastUpdated: result.lastUpdated
      }
    };
  }

  // Listar todas las competiciones cacheadas
  async listCachedCompetitions(): Promise<any> {
    const db = this.databaseService.db;
    
    const cached = await db
      .select({
        id: footballDataCacheTable.id,
        competitionId: footballDataCacheTable.competitionId,
        competitionName: footballDataCacheTable.competitionName,
        competitionCode: footballDataCacheTable.competitionCode,
        season: footballDataCacheTable.season,
        teamsCount: footballDataCacheTable.teamsCount,
        lastUpdated: footballDataCacheTable.lastUpdated,
        isActive: footballDataCacheTable.isActive,
      })
      .from(footballDataCacheTable)
      .where(eq(footballDataCacheTable.isActive, true))
      .orderBy(desc(footballDataCacheTable.lastUpdated));

    return {
      total: cached.length,
      competitions: cached,
      availableCompetitions: this.MAIN_COMPETITIONS
    };
  }

  // Obtener competiciones principales disponibles
  getMainCompetitions() {
    return this.MAIN_COMPETITIONS;
  }

  // === CRON JOBS ===

  // Ejecutar cache automático cada hora
  @Cron('0 * * * *') // Cada hora en el minuto 0
  async dailyCacheUpdate() {
    this.logger.log('🕒 Iniciando actualización automática horaria del cache de Football-Data...');
    
    try {
      const result = await this.cacheAllMainCompetitions();
      
      this.logger.log(`✅ Cache automático completado: ${result.successful}/${result.total} competiciones actualizadas`);
      
      if (result.failed && result.failed.length > 0) {
        this.logger.warn(`⚠️ Competiciones que fallaron: ${result.failed.map((f: any) => f.name).join(', ')}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error('❌ Error en la actualización automática del cache:', error.message);
      throw error;
    }
  }

  // Método para ejecutar cache manualmente (útil para testing)
  async forceCacheUpdate() {
    this.logger.log('🔄 Ejecutando actualización manual del cache...');
    return this.dailyCacheUpdate();
  }

  // Método para cachear competiciones gradualmente (una por vez con intervalos seguros)
  async cacheCompetitionsSafely(): Promise<any> {
    const competitions = Object.entries(this.MAIN_COMPETITIONS);
    let currentIndex = 0;
    
    // Obtener el estado del caché para determinar qué competición procesar siguiente
    const db = this.databaseService.db;
    const cachedCompetitions = await db
      .select()
      .from(footballDataCacheTable)
      .orderBy(desc(footballDataCacheTable.lastUpdated));
    
    const cachedIds = new Set(cachedCompetitions.map(c => c.competitionId));
    
    // Encontrar la primera competición no cacheada, o la más antigua
    let targetCompetition = competitions.find(([name, id]) => !cachedIds.has(id));
    
    if (!targetCompetition) {
      // Si todas están cacheadas, actualizar la más antigua
      const oldestCached = cachedCompetitions[cachedCompetitions.length - 1];
      targetCompetition = competitions.find(([name, id]) => id === oldestCached?.competitionId);
    }
    
    if (!targetCompetition) {
      return {
        message: 'No competitions to cache',
        action: 'none'
      };
    }
    
    const [name, id] = targetCompetition;
    
    try {
      console.log(`🎯 Safely caching single competition: ${name} (ID: ${id})`);
      const result = await this.cacheCompetition(id);
      
      return {
        message: `Successfully cached ${name}`,
        competition: name,
        competitionId: id,
        ...result,
        nextRecommendedAction: 'Wait 15+ seconds before calling this endpoint again'
      };
      
    } catch (error) {
      console.error(`❌ Failed to safely cache ${name}:`, error.message);
      
      return {
        success: false,
        competition: name,
        competitionId: id,
        error: error.message,
        recommendation: error.message.includes('429') 
          ? 'Wait 1-2 hours before trying again due to rate limiting'
          : 'Check API configuration and try again later'
      };
    }
  }
}
