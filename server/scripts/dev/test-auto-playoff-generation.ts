import "dotenv/config";

async function testAutoPlayoffGeneration() {
  console.log("=== PRUEBA DE GENERACIÓN AUTOMÁTICA DE PLAYOFFS ===");
  
  try {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const { sql, eq, and, inArray } = await import("drizzle-orm");
    
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
    
    // Simular el método checkAndGeneratePlayoffs del MatchSimulationService
    console.log("\n🔍 Verificando divisiones para generar playoffs...");
    
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
      
      // Verificar si la división está completa (isDivisionCompleted)
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
      
      // Verificar si ya existen playoffs (hasExistingPlayoffs)
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
      
      // Verificar si tiene slots de playoff configurados
      const hasPlayoffSlots = division.promotePlayoffSlots && division.promotePlayoffSlots > 0;
      
      console.log(`  📈 Partidos pendientes: ${pendingCount.count}`);
      console.log(`  🏆 Partidos de playoff existentes: ${playoffCount.count}`);
      console.log(`  🎯 Slots configurados: ${division.promotePlayoffSlots || 0}`);
      console.log(`  ✅ División completa: ${isCompleted}`);
      console.log(`  🔒 Tiene playoffs: ${hasPlayoffs}`);
      console.log(`  ⚙️ Configurada para playoffs: ${hasPlayoffSlots}`);
      
      if (isCompleted && !hasPlayoffs && hasPlayoffSlots) {
        console.log(`  🎉 ¡GENERAR PLAYOFFS! División ${division.name} cumple todos los criterios`);
        
        // Aquí se llamaría realmente a:
        // const playoffMatches = await this.seasonTransitionService.organizePlayoffs(division.id, activeSeason.id);
        console.log(`  📝 Acción: seasonTransitionService.organizePlayoffs(${division.id}, ${activeSeason.id})`);
        
        // Simular conteo de equipos en la división para calcular playoffs esperados
        const [teamCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(sql`team_league_assignments tla`)
          .innerJoin(leagueTable, eq(sql`tla.league_id`, leagueTable.id))
          .where(
            and(
              eq(leagueTable.divisionId, division.id),
              eq(sql`tla.season_id`, activeSeason.id)
            )
          );
          
        console.log(`  👥 Equipos en la división: ${teamCount.count}`);
        
        // Calcular partidos de playoff esperados (slots * (slots-1) / 2 para eliminación simple)
        const expectedPlayoffMatches = Math.max(0, (division.promotePlayoffSlots || 0) - 1);
        console.log(`  🏟️ Partidos de playoff esperados: ${expectedPlayoffMatches}`);
        
      } else {
        const reasons: string[] = [];
        if (!isCompleted) reasons.push("división no completa");
        if (hasPlayoffs) reasons.push("ya tiene playoffs");
        if (!hasPlayoffSlots) reasons.push("no configurada para playoffs");
        
        console.log(`  ⏸️ No generar playoffs: ${reasons.join(", ")}`);
      }
    }
    
    await pool.end();
    console.log("\n✅ Verificación completada");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testAutoPlayoffGeneration();
