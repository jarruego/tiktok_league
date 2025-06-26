import { pgTable, serial, integer, varchar, text, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export const footballDataCacheTable = pgTable('football_data_cache', {
  id: serial('id').primaryKey(),
  
  // Identificadores
  competitionId: integer('competition_id').notNull(), // 2014, 2021, etc.
  competitionName: varchar('competition_name', { length: 100 }).notNull(),
  competitionCode: varchar('competition_code', { length: 10 }).notNull(), // PD, PL, etc.
  
  // Datos completos en JSON
  rawData: jsonb('raw_data').notNull(), // Todo el JSON de la API
  
  // Metadatos
  season: varchar('season', { length: 20 }).notNull(), // 2024, 2024-25, etc.
  teamsCount: integer('teams_count').notNull(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  
  // Control
  isActive: boolean('is_active').default(true).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
