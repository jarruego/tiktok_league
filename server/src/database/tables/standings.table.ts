import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, timestamp } from 'drizzle-orm/pg-core';
import { teamTable } from './team.table';
import { seasonTable } from './season.table';
import { leagueTable } from './league.table';

export const standingsTable = pgTable('standings', {
  id: serial('id').primaryKey(),
  
  // Relaciones
  seasonId: integer('season_id').notNull().references(() => seasonTable.id, { onDelete: 'cascade' }),
  leagueId: integer('league_id').notNull().references(() => leagueTable.id, { onDelete: 'cascade' }),
  teamId: integer('team_id').notNull().references(() => teamTable.id, { onDelete: 'cascade' }),
  
  // Posición en la tabla
  position: integer('position').notNull(),
  
  // Estadísticas de partidos
  played: integer('played').notNull().default(0), // Partidos jugados
  won: integer('won').notNull().default(0),       // Partidos ganados
  drawn: integer('drawn').notNull().default(0),   // Partidos empatados
  lost: integer('lost').notNull().default(0),     // Partidos perdidos
  
  // Estadísticas de goles
  goalsFor: integer('goals_for').notNull().default(0),     // Goles a favor
  goalsAgainst: integer('goals_against').notNull().default(0), // Goles en contra
  goalDifference: integer('goal_difference').notNull().default(0), // Diferencia de goles
  
  // Puntos
  points: integer('points').notNull().default(0),
  
  // Metadatos
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relaciones
export const standingsRelations = relations(standingsTable, ({ one }) => ({
  season: one(seasonTable, {
    fields: [standingsTable.seasonId],
    references: [seasonTable.id],
  }),
  league: one(leagueTable, {
    fields: [standingsTable.leagueId],
    references: [leagueTable.id],
  }),
  team: one(teamTable, {
    fields: [standingsTable.teamId],
    references: [teamTable.id],
  }),
}));

export type Standing = typeof standingsTable.$inferSelect;
export type NewStanding = typeof standingsTable.$inferInsert;
