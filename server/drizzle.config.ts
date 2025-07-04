import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
