import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { StandingsService } from './standings.service';
import { 
  matchTable, 
  teamTable,
  MatchStatus 
} from '../database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { DATABASE_PROVIDER } from '../database/database.module';

interface TeamWithFollowers {
  id: number;
  name: string;
  followers: number;
}

export interface MatchSimulationResult {
  matchId: number;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number;
  awayGoals: number;
  algorithmDetails: {
    homeTeamFollowers: number;
    awayTeamFollowers: number;
    followersDifference: number;
    randomEvents: number;
    followerBasedEvents: number;
  };
}

@Injectable()
export class MatchSimulationService {
  private readonly logger = new Logger(MatchSimulationService.name);

  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
    private readonly standingsService: StandingsService,
  ) {}

  /**
   * Job programado para simular partidos automáticamente todos los días a las 17:00
   */
  @Cron('0 17 * * *', {
    name: 'daily-match-simulation',
    timeZone: 'Europe/Madrid',
  })
  async simulateTodaysMatches() {
    this.logger.log('🎮 Iniciando simulación automática diaria de partidos...');
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const results = await this.simulateMatchesByDate(today);
      
      if (results.length > 0) {
        this.logger.log(`⚽ ${results.length} partidos simulados exitosamente para el ${today}`);
        
        // Log de resultados destacados
        results.forEach(result => {
          this.logger.log(
            `📊 ${result.homeTeamName} ${result.homeGoals}-${result.awayGoals} ${result.awayTeamName}`
          );
        });

        // Recalcular clasificaciones si se simularon partidos
        this.logger.log('🔄 Recalculando clasificaciones...');
        
        // Obtener temporadas afectadas
        const affectedSeasons = new Set<number>();
        for (const result of results) {
          const [match] = await this.databaseService.db
            .select({ seasonId: matchTable.seasonId })
            .from(matchTable)
            .where(eq(matchTable.id, result.matchId));
          
          if (match) {
            affectedSeasons.add(match.seasonId);
          }
        }

        // Recalcular clasificaciones para cada temporada
        for (const seasonId of affectedSeasons) {
          await this.standingsService.recalculateStandingsForSeason(seasonId);
        }

        this.logger.log('✅ Clasificaciones actualizadas');
      } else {
        this.logger.log(`📅 No hay partidos programados para hoy (${today})`);
      }
    } catch (error) {
      this.logger.error('❌ Error en la simulación automática diaria:', error);
    }
  }

  /**
   * Simular todos los partidos de una fecha específica
   */
  async simulateMatchesByDate(date: string): Promise<MatchSimulationResult[]> {
    const db = this.databaseService.db;
    
    // Obtener partidos programados para esta fecha
    const matches = await db
      .select({
        id: matchTable.id,
        homeTeamId: matchTable.homeTeamId,
        awayTeamId: matchTable.awayTeamId,
        scheduledDate: matchTable.scheduledDate,
        status: matchTable.status,
        seasonId: matchTable.seasonId
      })
      .from(matchTable)
      .where(
        and(
          eq(matchTable.scheduledDate, date),
          eq(matchTable.status, MatchStatus.SCHEDULED)
        )
      );

    if (matches.length === 0) {
      return [];
    }

    this.logger.log(`🎯 Encontrados ${matches.length} partidos para simular el ${date}`);
    
    const results: MatchSimulationResult[] = [];    for (const match of matches) {
      try {
        const result = await this.simulateSingleMatch(match.id);
        results.push(result);
      } catch (error) {
        this.logger.error(`❌ Error simulando partido ${match.id}:`, error);
      }
    }

    // Recalcular clasificaciones si se simularon partidos
    if (results.length > 0) {
      this.logger.log('🔄 Recalculando clasificaciones...');
      
      // Obtener temporadas afectadas
      const affectedSeasons = new Set<number>();
      for (const match of matches) {
        affectedSeasons.add(match.seasonId);
      }

      // Recalcular clasificaciones para cada temporada
      for (const seasonId of affectedSeasons) {
        await this.standingsService.recalculateStandingsForSeason(seasonId);
      }

      this.logger.log('✅ Clasificaciones actualizadas');
    }

    return results;
  }

  /**
   * Simular un partido específico por ID
   */
  async simulateSingleMatch(matchId: number): Promise<MatchSimulationResult> {
    const db = this.databaseService.db;
    
    // Obtener información del partido
    const [match] = await db
      .select()
      .from(matchTable)
      .where(eq(matchTable.id, matchId));

    if (!match) {
      throw new NotFoundException(`Partido con ID ${matchId} no encontrado`);
    }

    if (match.status !== MatchStatus.SCHEDULED) {
      throw new Error(`El partido ${matchId} no está programado (estado: ${match.status})`);
    }

    // Obtener información de los equipos
    const [homeTeam, awayTeam] = await Promise.all([
      db.select().from(teamTable).where(eq(teamTable.id, match.homeTeamId)).then(result => result[0]),
      db.select().from(teamTable).where(eq(teamTable.id, match.awayTeamId)).then(result => result[0])
    ]);

    if (!homeTeam || !awayTeam) {
      throw new NotFoundException('Uno o ambos equipos no encontrados');
    }

    // Calcular resultado usando el algoritmo especificado
    const simulationResult = this.calculateMatchResult(
      {
        id: homeTeam.id,
        name: homeTeam.name,
        followers: homeTeam.followers
      },
      {
        id: awayTeam.id,
        name: awayTeam.name,
        followers: awayTeam.followers
      }
    );

    // Actualizar el partido en la base de datos
    await db
      .update(matchTable)
      .set({
        homeGoals: simulationResult.homeGoals,
        awayGoals: simulationResult.awayGoals,
        status: MatchStatus.FINISHED,
        simulationDetails: JSON.stringify(simulationResult.algorithmDetails),
        updatedAt: new Date()
      })
      .where(eq(matchTable.id, matchId));

    this.logger.log(
      `⚽ Partido simulado: ${homeTeam.name} ${simulationResult.homeGoals}-${simulationResult.awayGoals} ${awayTeam.name}`
    );

    return {
      matchId,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      homeGoals: simulationResult.homeGoals,
      awayGoals: simulationResult.awayGoals,
      algorithmDetails: simulationResult.algorithmDetails
    };
  }

  /**
   * Algoritmo de simulación de partidos
   * 25% probabilidad aleatoria + 75% basada en diferencia de seguidores
   */
  private calculateMatchResult(homeTeam: TeamWithFollowers, awayTeam: TeamWithFollowers) {
    const followersDifference = homeTeam.followers - awayTeam.followers;
    
    // Calcular ventaja porcentual basada en seguidores
    const totalFollowers = homeTeam.followers + awayTeam.followers;
    const homeAdvantage = totalFollowers > 0 ? (homeTeam.followers / totalFollowers) : 0.5;
    
    // Normalizar la ventaja para que no sea excesiva (entre 0.2 y 0.8)
    const normalizedHomeAdvantage = 0.2 + (homeAdvantage * 0.6);
    
    // Generar eventos de gol
    let homeGoals = 0;
    let awayGoals = 0;
    let randomEvents = 0;
    let followerBasedEvents = 0;
    
    // Simular entre 0 y 6 eventos de gol total (realista)
    const totalEvents = Math.floor(Math.random() * 7); // 0-6 goles en total
    
    for (let i = 0; i < totalEvents; i++) {
      const random = Math.random();
      
      if (random < 0.25) {
        // 25% completamente aleatorio
        randomEvents++;
        if (Math.random() < 0.5) {
          homeGoals++;
        } else {
          awayGoals++;
        }
      } else {
        // 75% basado en diferencia de seguidores
        followerBasedEvents++;
        if (Math.random() < normalizedHomeAdvantage) {
          homeGoals++;
        } else {
          awayGoals++;
        }
      }
    }
    
    // Aplicar factor de casa (ligera ventaja al equipo local)
    if (Math.random() < 0.15 && totalEvents > 0) { // 15% chance de gol extra en casa
      homeGoals++;
    }

    return {
      homeGoals,
      awayGoals,
      algorithmDetails: {
        homeTeamFollowers: homeTeam.followers,
        awayTeamFollowers: awayTeam.followers,
        followersDifference,
        randomEvents,
        followerBasedEvents
      }
    };
  }

  /**
   * Simular todos los partidos pendientes (útil para pruebas)
   */
  async simulateAllPendingMatches(): Promise<MatchSimulationResult[]> {
    const db = this.databaseService.db;
    
    const pendingMatches = await db
      .select({ 
        id: matchTable.id,
        seasonId: matchTable.seasonId 
      })
      .from(matchTable)
      .where(eq(matchTable.status, MatchStatus.SCHEDULED));

    this.logger.log(`🎮 Simulando ${pendingMatches.length} partidos pendientes...`);
    
    const results: MatchSimulationResult[] = [];
    
    for (const match of pendingMatches) {
      try {
        const result = await this.simulateSingleMatch(match.id);
        results.push(result);
      } catch (error) {
        this.logger.error(`❌ Error simulando partido ${match.id}:`, error);
      }
    }

    // Recalcular clasificaciones si se simularon partidos
    if (results.length > 0) {
      this.logger.log('🔄 Recalculando clasificaciones...');
      
      // Obtener temporadas afectadas
      const affectedSeasons = new Set(pendingMatches.map(m => m.seasonId));

      // Recalcular clasificaciones para cada temporada
      for (const seasonId of affectedSeasons) {
        await this.standingsService.recalculateStandingsForSeason(seasonId);
      }

      this.logger.log('✅ Clasificaciones actualizadas');
    }
    
    return results;
  }

  /**
   * Obtener estadísticas de simulación
   */
  async getSimulationStats() {
    const db = this.databaseService.db;
    
    const [stats] = await db
      .select({
        totalMatches: sql<number>`count(*)`,
        scheduledMatches: sql<number>`count(case when status = 'scheduled' then 1 end)`,
        finishedMatches: sql<number>`count(case when status = 'finished' then 1 end)`,
        averageGoalsPerMatch: sql<number>`avg(coalesce(home_goals, 0) + coalesce(away_goals, 0))`,
        homeWins: sql<number>`count(case when home_goals > away_goals then 1 end)`,
        awayWins: sql<number>`count(case when away_goals > home_goals then 1 end)`,
        draws: sql<number>`count(case when home_goals = away_goals then 1 end)`
      })
      .from(matchTable);

    return stats;
  }
}
