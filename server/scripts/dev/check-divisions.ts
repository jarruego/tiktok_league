import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { divisionTable } from "../../src/database/schema";
import { eq } from "drizzle-orm";

async function main() {
  // Conexión a la base de datos
  const connectionString = process.env.DATABASE_URL as string;
  if (!connectionString) {
    throw new Error("DATABASE_URL no está definido");
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false,
  });
  const db = drizzle(pool);

  try {
    // Consultar todas las divisiones
    const divisions = await db.select().from(divisionTable);
    
    console.log(`Se encontraron ${divisions.length} divisiones:`);
    divisions.forEach(division => {
      console.log(`- ID: ${division.id}, Nombre: ${division.name}, Nivel: ${division.level}`);
      console.log(`  Ligas: ${division.totalLeagues}, Equipos por liga: ${division.teamsPerLeague}`);
      console.log(`  Ascensos directos: ${division.promoteSlots || 0}, Playoffs ascenso: ${division.promotePlayoffSlots || 0}`);
      console.log(`  Descensos: ${division.relegateSlots || 0}, Clasificados torneos: ${division.tournamentSlots || 0}`);
      console.log('');
    });

    // Verificar si hay divisiones sin descripción
    const divisionsWithoutDescription = divisions.filter(division => !division.description || division.description.trim() === '');
    if (divisionsWithoutDescription.length > 0) {
      console.log("Divisiones sin descripción:");
      divisionsWithoutDescription.forEach(division => {
        console.log(`- ID: ${division.id}, Nombre: ${division.name}`);
      });
    } else {
      console.log("Todas las divisiones tienen descripciones configuradas correctamente.");
    }

    // Verificar si hay divisiones con configuración de descenso
    const divisionsWithRelegation = divisions.filter(division => division.relegateSlots && division.relegateSlots > 0);
    console.log(`\nDivisiones con descenso configurado: ${divisionsWithRelegation.length}`);
    
    // Verificar si hay divisiones con configuración de ascenso
    const divisionsWithPromotion = divisions.filter(division => division.promoteSlots && division.promoteSlots > 0);
    console.log(`Divisiones con ascenso configurado: ${divisionsWithPromotion.length}`);
    
    // Verificar valor de tournament_slots
    console.log("\nVerificando valor de tournament_slots para División 1:");
    const division1 = await db.select().from(divisionTable).where(eq(divisionTable.level, 1));
    if (division1.length > 0) {
      console.log(`División 1 (${division1[0].name}) - tournament_slots:`, division1[0].tournamentSlots);
    } else {
      console.log("No se encontró la División 1");
    }

    // Verificar configuración general
    console.log("\n=== RESUMEN GENERAL ===");
    console.log(`Total de divisiones: ${divisions.length}`);
    console.log(`Divisiones con ascenso directo: ${divisionsWithPromotion.length}`);
    console.log(`Divisiones con descenso: ${divisionsWithRelegation.length}`);
    
    const divisionsWithPlayoffs = divisions.filter(division => division.promotePlayoffSlots && division.promotePlayoffSlots > 0);
    console.log(`Divisiones con playoffs de ascenso: ${divisionsWithPlayoffs.length}`);
    
    const divisionsWithTournaments = divisions.filter(division => division.tournamentSlots && division.tournamentSlots > 0);
    console.log(`Divisiones con clasificación a torneos: ${divisionsWithTournaments.length}`);

  } catch (error) {
    console.error("Error al consultar divisiones:", error);
  } finally {
    // Cerrar la conexión
    await pool.end();
  }
}

main().catch(console.error);
