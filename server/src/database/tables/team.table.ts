import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const teamTable = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  tiktokId: varchar('tiktok_id', { length: 100 }).notNull(),
  followers: integer('followers').notNull().default(0),
  description: text('description'),
  lastScrapedAt: timestamp('last_scraped_at', { withTimezone: true }),
});

export type TeamSelectModel = InferSelectModel<typeof teamTable>;
export type TeamInsertModel = InferInsertModel<typeof teamTable>;
export type TeamUpdateModel = Partial<TeamInsertModel>;
