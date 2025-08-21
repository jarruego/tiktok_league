

import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { matchPlayerStatsTable } from '../database/tables/match-player-stats.table';
import { playerTable } from '../database/tables/player.table';
import { teamTable } from '../database/tables/team.table';
import { leagueTable } from '../database/tables/league.table';
import { matchTable } from '../database/tables/match.table';
import { desc, sql, and, inArray } from 'drizzle-orm';
import { DATABASE_PROVIDER } from '../database/database.module';

@Injectable()
export class StatsService {
  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService
  ) {}

  async getAllStats({ leagueId, divisionId }: { leagueId?: string, divisionId?: string } = {}) {
    const db = this.databaseService.getDb();
    let leagueIds: number[] | undefined = undefined;
    if (divisionId) {
      const leagues = await db.select({ id: sql`id` }).from(leagueTable).where(sql`${leagueTable.divisionId} = ${Number(divisionId)}`);
      leagueIds = leagues.map(l => Number(l.id));
    }
    const whereClause = leagueIds && leagueIds.length > 0
      ? inArray(matchTable.leagueId, leagueIds)
      : leagueId
        ? sql`${matchTable.leagueId} = ${Number(leagueId)}`
        : undefined;

    // Obtener todos los jugadores que han jugado en la liga/grupo
    const stats = await db
      .select({
        id: matchPlayerStatsTable.playerId,
        goals: sql`SUM(${matchPlayerStatsTable.goals})`.as('goals'),
        assists: sql`SUM(${matchPlayerStatsTable.assists})`.as('assists'),
      })
      .from(matchPlayerStatsTable)
      .innerJoin(matchTable, sql`${matchPlayerStatsTable.matchId} = ${matchTable.id}`)
      .where(whereClause)
      .groupBy(matchPlayerStatsTable.playerId);

    const playerIds = stats.map(s => s.id);
    const players = playerIds.length > 0
      ? await db
          .select({
            id: playerTable.id,
            name: playerTable.name,
            teamId: playerTable.teamId,
          })
          .from(playerTable)
          .where(inArray(playerTable.id, playerIds))
      : [];

    const teams = await db
      .select({
        id: teamTable.id,
        name: teamTable.name,
      })
      .from(teamTable);

    return stats.map(s => {
      const player = players.find(p => p.id === s.id);
      const team = teams.find(t => t.id === player?.teamId);
      return {
        id: s.id,
        name: player?.name || '',
        team: team?.name || '',
        goals: Number(s.goals) || 0,
        assists: Number(s.assists) || 0,
      };
    });
  }

  async getTopScorers({ leagueId, divisionId }: { leagueId?: string, divisionId?: string } = {}) {
    const db = this.databaseService.getDb();
    let leagueIds: number[] | undefined = undefined;
    if (divisionId) {
      const leagues = await db.select({ id: sql`id` }).from(leagueTable).where(sql`${leagueTable.divisionId} = ${Number(divisionId)}`);
      leagueIds = leagues.map(l => Number(l.id));
    }
    const whereClause = leagueIds && leagueIds.length > 0
      ? inArray(matchTable.leagueId, leagueIds)
      : leagueId
        ? sql`${matchTable.leagueId} = ${Number(leagueId)}`
        : undefined;

    const result = await db
      .select({
        id: matchPlayerStatsTable.playerId,
        value: sql`SUM(${matchPlayerStatsTable.goals})`.as('value'),
      })
      .from(matchPlayerStatsTable)
      .innerJoin(matchTable, sql`${matchPlayerStatsTable.matchId} = ${matchTable.id}`)
      .where(whereClause)
      .groupBy(matchPlayerStatsTable.playerId)
      .orderBy(desc(sql`SUM(${matchPlayerStatsTable.goals})`))
      .limit(20);

    // Obtener nombres y equipos
    const playerIds = result.map(r => r.id);
    const players = playerIds.length > 0
      ? await db
          .select({
            id: playerTable.id,
            name: playerTable.name,
            teamId: playerTable.teamId,
          })
          .from(playerTable)
          .where(inArray(playerTable.id, playerIds))
      : [];

    const teams = await db
      .select({
        id: teamTable.id,
        name: teamTable.name,
      })
      .from(teamTable);

    return result.map(r => {
      const player = players.find(p => p.id === r.id);
      const team = teams.find(t => t.id === player?.teamId);
      return {
        id: r.id,
        name: player?.name || '',
        team: team?.name || '',
        value: Number(r.value),
      };
    });
  }

  async getTopAssists({ leagueId, divisionId }: { leagueId?: string, divisionId?: string } = {}) {
    const db = this.databaseService.getDb();
    let leagueIds: number[] | undefined = undefined;
    if (divisionId) {
      const leagues = await db.select({ id: sql`id` }).from(leagueTable).where(sql`${leagueTable.divisionId} = ${Number(divisionId)}`);
      leagueIds = leagues.map(l => Number(l.id));
    }
    const whereClause = leagueIds && leagueIds.length > 0
      ? inArray(matchTable.leagueId, leagueIds)
      : leagueId
        ? sql`${matchTable.leagueId} = ${Number(leagueId)}`
        : undefined;

    const result = await db
      .select({
        id: matchPlayerStatsTable.playerId,
        value: sql`SUM(${matchPlayerStatsTable.assists})`.as('value'),
      })
      .from(matchPlayerStatsTable)
      .innerJoin(matchTable, sql`${matchPlayerStatsTable.matchId} = ${matchTable.id}`)
      .where(whereClause)
      .groupBy(matchPlayerStatsTable.playerId)
      .orderBy(desc(sql`SUM(${matchPlayerStatsTable.assists})`))
      .limit(20);

    // Obtener nombres y equipos
    const playerIds = result.map(r => r.id);
    const players = playerIds.length > 0
      ? await db
          .select({
            id: playerTable.id,
            name: playerTable.name,
            teamId: playerTable.teamId,
          })
          .from(playerTable)
          .where(inArray(playerTable.id, playerIds))
      : [];

    const teams = await db
      .select({
        id: teamTable.id,
        name: teamTable.name,
      })
      .from(teamTable);

    return result.map(r => {
      const player = players.find(p => p.id === r.id);
      const team = teams.find(t => t.id === player?.teamId);
      return {
        id: r.id,
        name: player?.name || '',
        team: team?.name || '',
        value: Number(r.value),
      };
    });
  }
}
