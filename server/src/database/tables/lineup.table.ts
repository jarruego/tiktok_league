import { pgTable, serial, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { teamTable } from './team.table';

export const lineupTable = pgTable('lineups', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').notNull().references(() => teamTable.id),
  lineup: jsonb('lineup').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type LineupSelectModel = InferSelectModel<typeof lineupTable>;
export type LineupInsertModel = InferInsertModel<typeof lineupTable>;
export type LineupUpdateModel = Partial<LineupInsertModel>;
