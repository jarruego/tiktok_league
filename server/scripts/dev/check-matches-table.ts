import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

async function checkMatchesTable() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    // Verificar la estructura de la tabla matches
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'matches' 
      ORDER BY ordinal_position;
    `);
    
    console.log("Columnas en la tabla 'matches':");
    console.log("================================");
    result.rows.forEach(row => {
      console.log(`${row.column_name} - ${row.data_type} (${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    // Verificar si existen las columnas is_playoff y playoff_round
    const hasIsPlayoff = result.rows.some(row => row.column_name === 'is_playoff');
    const hasPlayoffRound = result.rows.some(row => row.column_name === 'playoff_round');
    
    console.log("\n=== VERIFICACIÓN ===");
    console.log(`Columna 'is_playoff' existe: ${hasIsPlayoff}`);
    console.log(`Columna 'playoff_round' existe: ${hasPlayoffRound}`);
    
  } catch (error) {
    console.error("Error verificando tabla:", error);
  } finally {
    await pool.end();
  }
}

checkMatchesTable();
