import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const teamTable = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  tiktokId: varchar('tiktok_id', { length: 100 }).notNull(),
  displayName: varchar('display_name', { length: 100 }), // Nombre mostrado en TikTok
  followers: integer('followers').notNull().default(0),
  following: integer('following').default(0), // Siguiendo
  likes: integer('likes').default(0), // Me gustas totales
  description: text('description'),
  profileUrl: varchar('profile_url', { length: 500 }), // URL del perfil
  avatarUrl: text('avatar_url'), // URL de la imagen de perfil
  lastScrapedAt: timestamp('last_scraped_at', { withTimezone: true }),
});

export type TeamSelectModel = InferSelectModel<typeof teamTable>;
export type TeamInsertModel = InferInsertModel<typeof teamTable>;
export type TeamUpdateModel = Partial<TeamInsertModel>;
