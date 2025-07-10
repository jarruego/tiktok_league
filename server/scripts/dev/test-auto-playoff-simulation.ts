import "dotenv/config";

async function testAutoPlayoffDetectionInSimulation() {
  console.log("=== PRUEBA DE DETECCIÓN AUTOMÁTICA EN SIMULACIÓN ===");
  
  try {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const { eq, and, sql, inArray } = await import("drizzle-orm");
    
    console.log("Estableciendo conexión...");
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
    });
    
    const db = drizzle(pool);
    console.log("Conexión establecida");
    
    // Importar esquemas y servicios
    const { 
      matchTable, 
      leagueTable, 
      divisionTable, 
      seasonTable, 
      MatchStatus 
    } = await import("../../src/database/schema");
    
    const { DatabaseService } = await import("../../src/database/database.service");
    const { SeasonTransitionService } = await import("../../src/teams/season-transition.service");
    
    // Crear mock del databaseService
    const databaseService = {
      db: db,
      databaseConfig: null,
    } as any;
    
    // Crear mock del assignmentService
    const assignmentService = {} as any;
    
    // Crear mock del standingsService
    const standingsService = {} as any;
    
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
    
    // Simular el método checkAndGeneratePlayoffs del MatchSimulationService
    console.log("\n🔍 Ejecutando checkAndGeneratePlayoffs...");
    
    // Obtener todas las divisiones
    const divisions = await db
      .select()
      .from(divisionTable);
      
    for (const division of divisions) {
      console.log(`\n📊 Verificando División ${division.name}...`);
      
      // Obtener ligas de esta división
      const leagues = await db
        .select({ id: leagueTable.id })
        .from(leagueTable)
        .where(eq(leagueTable.divisionId, division.id));
        
      if (leagues.length === 0) {
        console.log("  ⚠️ No hay ligas en esta división");
        continue;
      }
      
      const leagueIds = leagues.map(l => l.id);
      
      // isDivisionCompleted logic
      const [pendingCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(matchTable)
        .where(
          and(
            eq(matchTable.seasonId, activeSeason.id),
            inArray(matchTable.leagueId, leagueIds),
            eq(matchTable.status, MatchStatus.SCHEDULED),
            sql`${matchTable.isPlayoff} IS NOT TRUE`
          )
        );
        
      const isCompleted = Number(pendingCount.count) === 0;
      
      // hasExistingPlayoffs logic
      const [playoffCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(matchTable)
        .where(
          and(
            eq(matchTable.seasonId, activeSeason.id),
            inArray(matchTable.leagueId, leagueIds),
            eq(matchTable.isPlayoff, true)
          )
        );
        
      const hasPlayoffs = Number(playoffCount.count) > 0;
      const hasPlayoffSlots = division.promotePlayoffSlots && division.promotePlayoffSlots > 0;
      
      console.log(`  📈 Pendientes: ${pendingCount.count}, Playoffs: ${playoffCount.count}, Slots: ${division.promotePlayoffSlots || 0}`);
      console.log(`  🔍 Completa: ${isCompleted}, TienePlayoffs: ${hasPlayoffs}, TieneSlots: ${hasPlayoffSlots}`);
      
      if (isCompleted && !hasPlayoffs && hasPlayoffSlots) {
        console.log(`  🎉 ¡GENERAR PLAYOFFS! División ${division.name}`);
        
        try {
          const playoffMatches = await seasonTransitionService.organizePlayoffs(division.id, activeSeason.id);
          
          if (playoffMatches && playoffMatches.length > 0) {
            console.log(`  ✅ Generados ${playoffMatches.length} partidos de playoff para División ${division.name}`);
          } else {
            console.log(`  ⚠️ No se pudieron generar playoffs para División ${division.name}`);
          }
        } catch (error) {
          console.log(`  ❌ Error generando playoffs: ${error.message}`);
        }
      } else if (hasPlayoffs) {
        console.log(`  ℹ️ División ${division.name} ya tiene playoffs generados`);
      } else if (!hasPlayoffSlots) {
        console.log(`  ℹ️ División ${division.name} no tiene playoffs configurados`);
      } else {
        console.log(`  ⏸️ División ${division.name} aún no está lista para playoffs`);
      }
    }
    
    await pool.end();
    console.log("\n✅ Verificación automática completada");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testAutoPlayoffDetectionInSimulation();
