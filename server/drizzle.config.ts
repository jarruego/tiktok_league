import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const databaseUrl = process.env.DATABASE_URL!;
const needsSSL = process.env.NODE_ENV === 'production' || databaseUrl.includes('render.com') || databaseUrl.includes('neon.tech');

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
    ssl: needsSSL ? { rejectUnauthorized: false } : false,
  },
});
