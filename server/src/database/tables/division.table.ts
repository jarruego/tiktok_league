import { pgTable, serial, varchar, integer, text } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const divisionTable = pgTable('divisions', {
  id: serial('id').primaryKey(),
  level: integer('level').notNull().unique(), // 1, 2, 3, 4, 5
  name: varchar('name', { length: 100 }).notNull(), // "División 1", "División 2", etc.
  description: text('description'),
  totalLeagues: integer('total_leagues').notNull(), // Número de ligas en esta división
  teamsPerLeague: integer('teams_per_league').notNull().default(20),
  promoteSlots: integer('promote_slots').default(0), // Equipos que ascienden automáticamente
  promotePlayoffSlots: integer('promote_playoff_slots').default(0), // Equipos que van a playoff de ascenso
  relegateSlots: integer('relegate_slots').default(0), // Equipos que descienden automáticamente
  tournamentSlots: integer('tournament_slots').default(0), // Equipos que clasifican a torneos
});

export type DivisionSelectModel = InferSelectModel<typeof divisionTable>;
export type DivisionInsertModel = InferInsertModel<typeof divisionTable>;
