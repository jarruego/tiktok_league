import { pgTable, serial, varchar, text, integer, date, timestamp } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { teamTable } from './team.table';

export const playerTable = pgTable('players', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').references(() => teamTable.id), // Cambiado a nullable para transferencias
  name: varchar('name', { length: 100 }).notNull(),
  position: varchar('position', { length: 50 }).notNull(),
  dateOfBirth: date('date_of_birth'),
  nationality: varchar('nationality', { length: 50 }),
  shirtNumber: integer('shirt_number'),
  role: varchar('role', { length: 20 }).notNull().default('PLAYER'), // PLAYER, CAPTAIN, etc.
  footballDataId: integer('football_data_id'), // ID del jugador en Football-Data para cruzar datos
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type PlayerSelectModel = InferSelectModel<typeof playerTable>;
export type PlayerInsertModel = InferInsertModel<typeof playerTable>;
export type PlayerUpdateModel = Partial<PlayerInsertModel>;
