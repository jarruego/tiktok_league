import { pgTable, serial, varchar, integer, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { divisionTable } from './division.table';

export const leagueTable = pgTable('leagues', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(), // "Liga Grupo A", "Liga Grupo B", etc.
  groupCode: varchar('group_code', { length: 10 }).notNull(), // "A", "B", "C", etc.
  divisionId: integer('division_id').notNull().references(() => divisionTable.id),
  maxTeams: integer('max_teams').notNull().default(20),
  description: text('description'),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  // Constraint única para evitar duplicados de liga por división y grupo
  uniqueDivisionGroup: unique().on(table.divisionId, table.groupCode),
}));

export type LeagueSelectModel = InferSelectModel<typeof leagueTable>;
export type LeagueInsertModel = InferInsertModel<typeof leagueTable>;
