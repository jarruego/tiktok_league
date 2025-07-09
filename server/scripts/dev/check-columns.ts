import "dotenv/config";

async function checkColumns() {
  console.log("=== VERIFICAR COLUMNAS DE LA TABLA MATCHES ===");
  
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
    
    // Verificar las columnas de la tabla matches
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'matches' 
      ORDER BY ordinal_position;
    `);
    
    console.log("\nColumnas en la tabla 'matches':");
    console.log("================================");
    result.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type}) - Nullable: ${row.is_nullable} - Default: ${row.column_default || 'none'}`);
    });
    
    // Verificar específicamente las columnas que necesitamos
    const playoffColumns = result.rows.filter(row => 
      row.column_name === 'is_playoff' || row.column_name === 'playoff_round'
    );
    
    console.log("\n=== COLUMNAS DE PLAYOFF ===");
    if (playoffColumns.length === 0) {
      console.log("❌ Las columnas is_playoff y playoff_round NO existen");
    } else {
      console.log("✅ Columnas de playoff encontradas:");
      playoffColumns.forEach(col => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    }
    
    await pool.end();
    console.log("\nConexión cerrada");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

checkColumns();
