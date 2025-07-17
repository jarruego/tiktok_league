import { Global, Module } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
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
        
        // Configurar SSL para conexiones remotas
        const pool = new Pool({
          connectionString: databaseUrl,
          ssl: process.env.NODE_ENV === 'production' || databaseUrl.includes('render.com') 
            ? { rejectUnauthorized: false } 
            : false,
        });
        
        const db = drizzle(pool);
        return new DatabaseService(db);
      },
    },
    // DatabaseService eliminado, solo se usa el provider DATABASE_PROVIDER
    MigrationService,
  ],
  exports: [DATABASE_PROVIDER, MigrationService],
})
export class DatabaseModule {}
