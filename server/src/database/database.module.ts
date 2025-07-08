import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DatabaseService } from './database.service';
import { MigrationService } from './migration.service';
import { MigrationController } from './migration.controller';
import * as dotenv from 'dotenv';

export const DATABASE_PROVIDER = 'db-provider';

dotenv.config();

@Global()
@Module({
  controllers: [MigrationController],
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
    MigrationService,
  ],
  exports: [DATABASE_PROVIDER, MigrationService],
})
export class DatabaseModule {}
