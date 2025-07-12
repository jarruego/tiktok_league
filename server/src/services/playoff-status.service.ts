import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_PROVIDER } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { matchTable, leagueTable, MatchStatus } from '../database/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

@Injectable()
export class PlayoffStatusService {
  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Devuelve true si existen partidos de playoff en estado pendiente o en curso para una liga y temporada
   */
  async isPlayoffActiveForLeague(seasonId: number, leagueId: number): Promise<boolean> {
    const db = this.databaseService.db;
    const pendingStatuses = [MatchStatus.SCHEDULED, MatchStatus.LIVE];
    const matches = await db
      .select({ id: matchTable.id })
      .from(matchTable)
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          eq(matchTable.leagueId, leagueId),
          eq(matchTable.isPlayoff, true),
          // Estado pendiente o en curso
          inArray(matchTable.status, pendingStatuses)
        )
      );
    return matches.length > 0;
  }

  /**
   * Devuelve true si existen partidos de playoff en estado pendiente o en curso para una división y temporada
   */
  async isPlayoffActiveForDivision(seasonId: number, divisionId: number): Promise<boolean> {
    const db = this.databaseService.db;
    const pendingStatuses = [MatchStatus.SCHEDULED, MatchStatus.LIVE];
    // Necesitamos join con leagueTable para obtener divisionId
    const matches = await db
      .select({ id: matchTable.id })
      .from(matchTable)
      .innerJoin(leagueTable, eq(matchTable.leagueId, leagueTable.id))
      .where(
        and(
          eq(matchTable.seasonId, seasonId),
          eq(matchTable.isPlayoff, true),
          eq(leagueTable.divisionId, divisionId),
          inArray(matchTable.status, pendingStatuses)
        )
      );
    return matches.length > 0;
  }
}
