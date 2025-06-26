import { pgTable, serial, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const coachTable = pgTable('coaches', {
  id: serial('id').primaryKey(),
  footballDataId: integer('football_data_id'), // Sin unique constraint por ahora
  name: varchar('name', { length: 100 }).notNull(),
  nationality: varchar('nationality', { length: 50 }),
  dateOfBirth: varchar('date_of_birth', { length: 20 }), // Algunos entrenadores no tienen fecha exacta
  contract: text('contract'), // Información del contrato
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type CoachSelectModel = InferSelectModel<typeof coachTable>;
export type CoachInsertModel = InferInsertModel<typeof coachTable>;
export type CoachUpdateModel = Partial<CoachInsertModel>;
