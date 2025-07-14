import { pgTable, serial, varchar, integer } from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { teamTable } from './team.table';

export const userTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(), // 'admin', 'moderator', 'user'
  displayName: varchar('display_name', { length: 100 }),
  avatar: varchar('avatar', { length: 255 }),
  provider: varchar('provider', { length: 50 }),
  teamId: integer('team_id').references(() => teamTable.id),
});

export type UserSelectModel = InferSelectModel<typeof userTable>;
export type UserInsertModel = InferInsertModel<typeof userTable>;
