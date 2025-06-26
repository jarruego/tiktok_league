import { pgTable, serial, varchar, integer, timestamp, boolean } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const seasonTable = pgTable('seasons', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(), // "Temporada 2024-25"
  year: integer('year').notNull(), // 2024
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  isActive: boolean('is_active').default(false),
  isCompleted: boolean('is_completed').default(false),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type SeasonSelectModel = InferSelectModel<typeof seasonTable>;
export type SeasonInsertModel = InferInsertModel<typeof seasonTable>;
