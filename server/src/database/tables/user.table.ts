import { pgTable, serial, varchar } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export const userTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(), // 'admin', 'moderator', 'user'
});

export type UserSelectModel = InferSelectModel<typeof userTable>;
export type UserInsertModel = InferInsertModel<typeof userTable>;
