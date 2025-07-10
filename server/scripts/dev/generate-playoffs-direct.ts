import "dotenv/config";

async function generatePlayoffsDirectly() {
  console.log("=== GENERANDO PLAYOFFS DIRECTAMENTE ===");
  
  try {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const { eq } = await import("drizzle-orm");
    
    console.log("Estableciendo conexión...");
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
    });
    
    const db = drizzle(pool);
    console.log("Conexión establecida");
    
    // Importar módulos necesarios
    const { DatabaseService } = await import("../../src/database/database.service");
    const { SeasonTransitionService } = await import("../../src/teams/season-transition.service");
    const { seasonTable } = await import("../../src/database/schema");
    
    // Crear mock del databaseService
    const databaseService = {
      db: db,
      databaseConfig: null,
    } as any;
    
    // Crear mock del assignmentService
    const assignmentService = {
      // Métodos mínimos requeridos para el testing
    } as any;
    
    // Crear mock del standingsService
    const standingsService = {
      // Métodos mínimos requeridos para el testing
    } as any;
    
    const seasonTransitionService = new SeasonTransitionService(databaseService, assignmentService, standingsService);
    
    // Obtener la temporada activa
    const [activeSeason] = await db
      .select()
      .from(seasonTable)
      .where(eq(seasonTable.isActive, true));
      
    if (!activeSeason) {
      console.log("❌ No hay temporada activa");
      return;
    }
    
    console.log(`📅 Temporada activa: ${activeSeason.name} (ID: ${activeSeason.id})`);
    
    // Generar playoffs para División 2 (ID: 217)
    console.log("\n🎯 Generando playoffs para División 2...");
    
    const playoffMatches = await seasonTransitionService.organizePlayoffs(217, activeSeason.id);
    
    if (playoffMatches && playoffMatches.length > 0) {
      console.log(`🎉 ¡Éxito! Se generaron ${playoffMatches.length} partidos de playoff:`);
      
      for (const match of playoffMatches) {
        console.log(`  🏟️ Partido: ${match.homeTeamName} vs ${match.awayTeamName} (Ronda ${match.round})`);
      }
    } else {
      console.log("⚠️ No se generaron partidos de playoff");
    }
    
    await pool.end();
    console.log("\n✅ Proceso completado");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

generatePlayoffsDirectly();
