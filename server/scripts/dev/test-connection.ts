import "dotenv/config";

async function testConnection() {
  console.log("=== TEST DE CONEXIÓN ===");
  console.log("DATABASE_URL definido:", !!process.env.DATABASE_URL);
  
  if (process.env.DATABASE_URL) {
    console.log("URL de conexión (ocultada):", process.env.DATABASE_URL.substring(0, 20) + "...");
  }
  
  try {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const { divisionTable } = await import("../../src/database/schema");
    
    console.log("Imports exitosos");
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
    });
    
    const db = drizzle(pool);
    console.log("Conexión a la base de datos establecida");
    
    const result = await db.select().from(divisionTable).limit(1);
    console.log("Consulta exitosa, número de registros:", result.length);
    
    if (result.length > 0) {
      console.log("Primera división encontrada:", result[0].name);
    }
    
    await pool.end();
    console.log("Conexión cerrada correctamente");
    
  } catch (error) {
    console.error("Error en el test:", error);
  }
}

testConnection();
