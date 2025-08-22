
import { pgTable, serial, integer, jsonb } from 'drizzle-orm/pg-core';


export const matchPlayerStatsTable = pgTable('match_player_stats', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id').notNull(),
  playerId: integer('player_id').notNull(),
  teamId: integer('team_id').notNull(),
  goals: integer('goals').notNull().default(0),
  assists: integer('assists').notNull().default(0),
  goalMinutes: jsonb('goal_minutes').$type<number[]>().default([]), // array de minutos de los goles marcados
  minutesPlayed: integer('minutes_played').notNull().default(90), // minutos jugados por el jugador en el partido
  // Puedes añadir más campos según lo que quieras registrar
});

// Relación única por partido y jugador
// Esto se puede reforzar en la migración con un índice único (match_id, player_id)
