import { eq } from 'drizzle-orm';
import { teamTable } from './tables/team.table';
import { DatabaseService } from './database.service';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as dotenv from 'dotenv';

dotenv.config();

// Ejemplo de cuentas famosas de TikTok asociadas a equipos
const teams = [
  { name: 'Team Messi', tiktokId: 'leomessi', followers: 0 },
  { name: 'Team PSG', tiktokId: 'psg', followers: 0 },
  { name: 'Team Real Madrid', tiktokId: 'realmadrid', followers: 0 },
  { name: 'Team NBA', tiktokId: 'nba', followers: 0 },
  { name: 'Team Liverpool', tiktokId: 'liverpoolfc', followers: 0 },
];

async function seed() {
  const databaseUrl = process.env.DATABASE_URL as string;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not defined');
  }
  const dbInstance = drizzle(databaseUrl);
  const databaseService = new DatabaseService(dbInstance);
  const db = databaseService.db;

  for (const team of teams) {
    // Verifica si el equipo ya existe por tiktokId
    const exists = await db.select().from(teamTable).where(eq(teamTable.tiktokId, team.tiktokId));
    if (exists.length === 0) {
      await db.insert(teamTable).values(team);
      console.log(`Equipo insertado: ${team.name}`);
    } else {
      console.log(`Ya existe: ${team.name}`);
    }
  }
  console.log('Seed finalizado.');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
