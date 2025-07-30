import { pgTable, serial, integer } from 'drizzle-orm/pg-core';

export const matchPlayerStatsTable = pgTable('match_player_stats', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').notNull(),
  playerId: integer('player_id').notNull(),
  teamId: integer('team_id').notNull(),
  goals: integer('goals').notNull().default(0),
  assists: integer('assists').notNull().default(0),
  // Puedes añadir más campos según lo que quieras registrar
});

// Relación única por partido y jugador
// Esto se puede reforzar en la migración con un índice único (match_id, player_id)
