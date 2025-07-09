import { sql } from 'drizzle-orm';
import { 
  pgTable, 
  serial, 
  integer, 
  varchar, 
  text, 
  boolean, 
  date, 
  timestamp, 
  pgEnum
} from 'drizzle-orm/pg-core';

// Esquema para registrar transiciones de temporada
export const seasonTransitionTable = pgTable('season_transitions', {
  id: serial('id').primaryKey(),
  
  // Temporadas involucradas
  currentSeasonId: integer('current_season_id').notNull().references(() => seasonTable.id, { onDelete: 'cascade' }),
  nextSeasonId: integer('next_season_id').references(() => seasonTable.id, { onDelete: 'set null' }),
  
  // Metadatos
  transitionDate: timestamp('transition_date').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('completed'),
  summary: text('summary'),
  
  // Estadísticas
  directPromotions: integer('direct_promotions').default(0),
  directRelegations: integer('direct_relegations').default(0),
  playoffTeams: integer('playoff_teams').default(0),
  playoffMatches: integer('playoff_matches').default(0),
  tournamentQualifiers: integer('tournament_qualifiers').default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Añadir campos para la transición de temporada en la tabla de asignaciones
export const alterTeamLeagueAssignmentTable = sql`
  ALTER TABLE team_league_assignments
  ADD COLUMN IF NOT EXISTS promoted_next_season BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS relegated_next_season BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS playoff_next_season BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS qualified_for_tournament BOOLEAN DEFAULT FALSE;
`;

// Añadir campo para identificar partidos de playoff
export const alterMatchTable = sql`
  ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS is_playoff BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS playoff_round VARCHAR(50);
`;
