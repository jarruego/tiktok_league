import "dotenv/config";

async function addPlayoffColumns() {
  console.log("=== AÑADIR COLUMNAS DE PLAYOFF ===");
  
  try {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const { sql } = await import("drizzle-orm");
    
    console.log("Estableciendo conexión...");
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
    });
    
    const db = drizzle(pool);
    console.log("Conexión establecida");
    
    // Añadir las columnas is_playoff y playoff_round
    console.log("\nAñadiendo columna is_playoff...");
    await db.execute(sql`ALTER TABLE "matches" ADD COLUMN "is_playoff" boolean DEFAULT false;`);
    console.log("✅ Columna is_playoff añadida");
    
    console.log("\nAñadiendo columna playoff_round...");
    await db.execute(sql`ALTER TABLE "matches" ADD COLUMN "playoff_round" varchar(50);`);
    console.log("✅ Columna playoff_round añadida");
    
    // Verificar que las columnas se han añadido correctamente
    console.log("\nVerificando las nuevas columnas...");
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'matches' AND (column_name = 'is_playoff' OR column_name = 'playoff_round')
      ORDER BY column_name;
    `);
    
    if (result.rows.length > 0) {
      console.log("✅ Columnas verificadas:");
      result.rows.forEach(row => {
        console.log(`  - ${row.column_name} (${row.data_type}) - Default: ${row.column_default || 'none'}`);
      });
    } else {
      console.log("❌ No se encontraron las columnas nuevas");
    }
    
    await pool.end();
    console.log("\nConexión cerrada");
    console.log("🎉 Proceso completado exitosamente");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

addPlayoffColumns();
