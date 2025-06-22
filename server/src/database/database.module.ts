import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DatabaseService } from './database.service';
import * as dotenv from 'dotenv';

export const DATABASE_PROVIDER = 'db-provider';

dotenv.config();

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_PROVIDER,
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL as string;
        if (!databaseUrl) {
          throw new Error('DATABASE_URL environment variable is not defined');
        }
        const db = drizzle(databaseUrl);
        return new DatabaseService(db);
      },
    },
  ],
  exports: [DATABASE_PROVIDER],
})
export class DatabaseModule {}
