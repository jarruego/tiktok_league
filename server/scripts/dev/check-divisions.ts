import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { divisionTable } from '../src/database/schema';
import { eq } from 'drizzle-orm';

async function main() {
  // Conexión a la base de datos
  const connectionString = process.env.DATABASE_URL as string;
  if (!connectionString) {
    throw new Error('DATABASE_URL no está definido');
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    // Consultar todas las divisiones
    const divisions = await db.select().from(divisionTable);
    console.log('Divisiones encontradas:', divisions.length);
    console.log(JSON.stringify(divisions, null, 2));

    // Verificar específicamente el campo tournament_slots
    console.log('\nVerificando valor de tournament_slots para División 1:');
    const division1 = await db.select().from(divisionTable).where(eq(divisionTable.level, 1));
    if (division1.length > 0) {
      console.log(`División 1 (${division1[0].name}) - tournament_slots:`, division1[0].tournamentSlots);
    } else {
      console.log('No se encontró la División 1');
    }
  } catch (error) {
    console.error('Error al consultar divisiones:', error);
  } finally {
    // Cerrar la conexión
    await client.end();
  }
}

main().catch(console.error);
