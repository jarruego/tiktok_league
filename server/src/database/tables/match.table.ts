import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, timestamp, varchar, boolean, date } from 'drizzle-orm/pg-core';
import { teamTable } from './team.table';
import { seasonTable } from './season.table';
import { leagueTable } from './league.table';

// Enum para el estado del partido
export const MatchStatus = {
  SCHEDULED: 'scheduled',     // Programado (futuro)
  LIVE: 'live',              // En curso
  FINISHED: 'finished',       // Finalizado
  POSTPONED: 'postponed',     // Aplazado
  CANCELLED: 'cancelled'      // Cancelado
} as const;

export type MatchStatus = typeof MatchStatus[keyof typeof MatchStatus];

export const matchTable = pgTable('matches', {
  id: serial('id').primaryKey(),
  
  // Relaciones con otras tablas
  seasonId: integer('season_id').notNull().references(() => seasonTable.id, { onDelete: 'cascade' }),
  leagueId: integer('league_id').notNull().references(() => leagueTable.id, { onDelete: 'cascade' }),
  homeTeamId: integer('home_team_id').notNull().references(() => teamTable.id, { onDelete: 'cascade' }),
  awayTeamId: integer('away_team_id').notNull().references(() => teamTable.id, { onDelete: 'cascade' }),
  
  // Información del partido
  matchday: integer('matchday').notNull(), // Jornada (1, 2, 3...)
  scheduledDate: date('scheduled_date').notNull(), // Fecha programada
  status: varchar('status', { length: 20 }).notNull().default(MatchStatus.SCHEDULED),
  
  // Resultados (para futuro)
  homeGoals: integer('home_goals'), // null = no jugado aún
  awayGoals: integer('away_goals'), // null = no jugado aún
  
  // Detalles de la simulación (JSON)
  simulationDetails: varchar('simulation_details', { length: 1000 }), // JSON con detalles del algoritmo
  
  // Metadatos
  notes: varchar('notes', { length: 500 }), // Notas adicionales
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relaciones
export const matchRelations = relations(matchTable, ({ one }) => ({
  season: one(seasonTable, {
    fields: [matchTable.seasonId],
    references: [seasonTable.id],
  }),
  league: one(leagueTable, {
    fields: [matchTable.leagueId],
    references: [leagueTable.id],
  }),
  homeTeam: one(teamTable, {
    fields: [matchTable.homeTeamId],
    references: [teamTable.id],
    relationName: 'homeMatches'
  }),
  awayTeam: one(teamTable, {
    fields: [matchTable.awayTeamId],
    references: [teamTable.id],
    relationName: 'awayMatches'
  }),
}));

export type Match = typeof matchTable.$inferSelect;
export type NewMatch = typeof matchTable.$inferInsert;
