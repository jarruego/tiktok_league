import "dotenv/config";

async function testPlayoffDetection() {
  console.log("=== PRUEBA DE DETECCIÓN DE PLAYOFFS ===");
  
  try {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const { sql, eq, and } = await import("drizzle-orm");
    
    console.log("Estableciendo conexión...");
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
    });
    
    const db = drizzle(pool);
    console.log("Conexión establecida");
    
    // Importar las tablas necesarias
    const { matchTable, leagueTable, divisionTable, seasonTable, MatchStatus } = await import("../../src/database/schema");
    
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
    
    // Obtener todas las divisiones
    const divisions = await db
      .select()
      .from(divisionTable);
      
    console.log(`\n📊 Verificando ${divisions.length} divisiones...`);
    
    for (const division of divisions) {
      console.log(`\n🔍 Verificando División ${division.name} (Nivel ${division.level})...`);
      
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
      console.log(`  📋 Ligas en la división: ${leagueIds.join(', ')}`);
      
      // Contar partidos pendientes (no playoff)
      const [pendingCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(matchTable)
        .where(
          and(
            eq(matchTable.seasonId, activeSeason.id),
            sql`${matchTable.leagueId} IN (${sql.join(leagueIds, sql`, `)})`,
            eq(matchTable.status, MatchStatus.SCHEDULED),
            sql`${matchTable.isPlayoff} IS NOT TRUE`
          )
        );
        
      // Contar partidos de playoff existentes
      const [playoffCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(matchTable)
        .where(
          and(
            eq(matchTable.seasonId, activeSeason.id),
            sql`${matchTable.leagueId} IN (${sql.join(leagueIds, sql`, `)})`,
            eq(matchTable.isPlayoff, true)
          )
        );
        
      // Contar partidos finalizados
      const [finishedCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(matchTable)
        .where(
          and(
            eq(matchTable.seasonId, activeSeason.id),
            sql`${matchTable.leagueId} IN (${sql.join(leagueIds, sql`, `)})`,
            eq(matchTable.status, MatchStatus.FINISHED),
            sql`${matchTable.isPlayoff} IS NOT TRUE`
          )
        );
      
      console.log(`  📈 Partidos regulares pendientes: ${pendingCount.count}`);
      console.log(`  ✅ Partidos regulares finalizados: ${finishedCount.count}`);
      console.log(`  🏆 Partidos de playoff: ${playoffCount.count}`);
      console.log(`  🎯 Slots de playoff configurados: ${division.promotePlayoffSlots || 0}`);
      
      // Determinar el estado
      const pendingCountValue = Number(pendingCount.count) || 0;
      const isCompleted = pendingCountValue === 0;
      const hasPlayoffs = Number(playoffCount.count) > 0;
      const hasPlayoffSlots = division.promotePlayoffSlots && division.promotePlayoffSlots > 0;
      
      console.log(`  🔍 Debug: pendingCountValue=${pendingCountValue}, typeof=${typeof pendingCountValue}, isCompleted=${isCompleted}, hasPlayoffs=${hasPlayoffs}, hasPlayoffSlots=${hasPlayoffSlots}, finishedCount=${Number(finishedCount.count)}`);
      
      if (isCompleted && !hasPlayoffs && hasPlayoffSlots && Number(finishedCount.count) > 0) {
        console.log(`  🎉 ¡DIVISIÓN COMPLETA! Se pueden generar ${division.promotePlayoffSlots} slots de playoff`);
        
        // Aquí se llamaría a seasonTransitionService.organizePlayoffs()
        console.log(`  💡 Acción requerida: Generar partidos de playoff para División ${division.name}`);
      } else if (isCompleted && hasPlayoffSlots && Number(finishedCount.count) > 0 && !hasPlayoffs) {
        console.log(`  🔥 ¡CANDIDATA A PLAYOFFS! División ${division.name} está lista para playoffs`);
      } else if (hasPlayoffs) {
        console.log(`  ✅ División ya tiene playoffs generados`);
      } else if (!hasPlayoffSlots) {
        console.log(`  ℹ️  División no tiene playoffs configurados`);
      } else if (!isCompleted) {
        console.log(`  ⏳ División aún no está completa (${pendingCountValue} partidos pendientes)`);
      } else if (Number(finishedCount.count) === 0) {
        console.log(`  📭 División sin partidos jugados aún`);
      } else {
        console.log(`  🤔 Estado indeterminado - Completa: ${isCompleted}, Playoffs: ${hasPlayoffs}, Slots: ${hasPlayoffSlots}, Finalizados: ${Number(finishedCount.count)}`);
      }
    }
    
    await pool.end();
    console.log("\n✅ Análisis completado");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testPlayoffDetection();
