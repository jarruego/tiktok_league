import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { coachTable } from './coach.table';

export const teamTable = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  isBot: integer('is_bot').notNull().default(0), // 0 = no bot, 1 = bot
  // Campos existentes para TikTok
  tiktokId: varchar('tiktok_id', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 100 }), // Nombre mostrado en TikTok
  followers: integer('followers').notNull().default(0),
  following: integer('following').default(0), // Siguiendo
  likes: integer('likes').default(0), // Me gustas totales
  description: text('description'),
  profileUrl: varchar('profile_url', { length: 500 }), // URL del perfil
  avatarUrl: text('avatar_url'), // URL de la imagen de perfil
  lastScrapedAt: timestamp('last_scraped_at', { withTimezone: true }),
  lastAutoImportedAt: timestamp('last_auto_imported_at', { withTimezone: true }),
  failedScrapingAttempts: integer('failed_scraping_attempts').default(0), // Contador de intentos fallidos
  lastFailedAt: timestamp('last_failed_at', { withTimezone: true }), // Última vez que falló
  
  // Nuevos campos para Football-Data.org
  footballDataId: integer('football_data_id'), // Sin unique constraint por ahora
  competitionId: integer('competition_id'), // ID de la competición de Football-Data.org
  shortName: varchar('short_name', { length: 50 }), // Nombre corto del equipo
  tla: varchar('tla', { length: 5 }), // Three Letter Abbreviation
  crest: text('crest'), // URL del escudo del equipo
  venue: varchar('venue', { length: 200 }), // Estadio
  founded: integer('founded'), // Año de fundación
  clubColors: varchar('club_colors', { length: 100 }), // Colores del club
  website: varchar('website', { length: 500 }), // Sitio web oficial
  
  // Información del área/país
  areaId: integer('area_id'), // ID del área de Football-Data.org
  areaName: varchar('area_name', { length: 100 }), // Nombre del país/área
  areaCode: varchar('area_code', { length: 10 }), // Código del país (ESP, ENG, etc.)
  areaFlag: text('area_flag'), // URL de la bandera del país
  
  // Relación con entrenador
  coachId: integer('coach_id').references(() => coachTable.id),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type TeamSelectModel = InferSelectModel<typeof teamTable>;
export type TeamInsertModel = InferInsertModel<typeof teamTable>;
export type TeamUpdateModel = Partial<TeamInsertModel>;
