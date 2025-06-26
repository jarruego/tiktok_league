import { pgTable, serial, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { teamTable } from './team.table';
import { leagueTable } from './league.table';
import { seasonTable } from './season.table';

// Enum para razones de asignación a liga
export enum AssignmentReason {
  INITIAL_TIKTOK = 0,    // Asignación inicial por número de seguidores en TikTok
  PROMOTION = 1,         // Ascenso por méritos deportivos
  RELEGATION = 2,        // Descenso por méritos deportivos
  PLAYOFF = 3,           // Asignación por playoff
  LATER_AVAILABILITY = 4 // Asignación posterior por disponibilidad de espacios
}

export const teamLeagueAssignmentTable = pgTable('team_league_assignments', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teamTable.id),
  leagueId: integer('league_id').notNull().references(() => leagueTable.id),
  seasonId: integer('season_id').notNull().references(() => seasonTable.id),
  
  // Información del ranking al momento de asignación
  tiktokFollowersAtAssignment: integer('tiktok_followers_at_assignment').default(0),
  assignmentReason: integer('assignment_reason').notNull().default(AssignmentReason.INITIAL_TIKTOK),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  teamSeasonUnique: uniqueIndex('team_season_unique').on(table.teamId, table.seasonId),
}));

export type TeamLeagueAssignmentSelectModel = InferSelectModel<typeof teamLeagueAssignmentTable>;
export type TeamLeagueAssignmentInsertModel = InferInsertModel<typeof teamLeagueAssignmentTable>;
