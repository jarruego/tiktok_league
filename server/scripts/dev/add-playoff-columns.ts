import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

async function addPlayoffColumns() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log("Agregando columnas is_playoff y playoff_round a la tabla matches...");
    
    // Agregar columna is_playoff
    await pool.query(`
      ALTER TABLE matches 
      ADD COLUMN IF NOT EXISTS is_playoff boolean DEFAULT false;
    `);
    console.log("✅ Columna 'is_playoff' agregada");
    
    // Agregar columna playoff_round
    await pool.query(`
      ALTER TABLE matches 
      ADD COLUMN IF NOT EXISTS playoff_round varchar(50);
    `);
    console.log("✅ Columna 'playoff_round' agregada");
    
    // Verificar que las columnas se agregaron correctamente
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'matches' 
      AND column_name IN ('is_playoff', 'playoff_round')
      ORDER BY column_name;
    `);
    
    console.log("\n=== VERIFICACIÓN FINAL ===");
    result.rows.forEach(row => {
      console.log(`${row.column_name} - ${row.data_type} (${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    console.log("\n🎉 Migración completada exitosamente!");
    
  } catch (error) {
    console.error("❌ Error aplicando migración:", error);
  } finally {
    await pool.end();
  }
}

addPlayoffColumns();
