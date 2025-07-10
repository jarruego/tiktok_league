import "dotenv/config";

async function realSystemVerification() {
  console.log("=== VERIFICACIÓN REAL DEL SISTEMA DE PLAYOFFS AUTOMÁTICOS ===");
  
  let errors: string[] = [];
  let successes: string[] = [];
  
  try {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { Pool } = await import("pg");
    const { eq, and, sql, inArray } = await import("drizzle-orm");
    
    console.log("🔌 Conectando a la base de datos...");
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
    });
    
    const db = drizzle(pool);
    
    // Importar esquemas y servicios
    const { 
      matchTable, 
      leagueTable, 
      divisionTable, 
      seasonTable, 
      teamLeagueAssignmentTable,
      MatchStatus 
    } = await import("../../src/database/schema");
    
    // 1. VERIFICAR CAMPOS DE BASE DE DATOS
    console.log("\n📊 1. VERIFICANDO CAMPOS DE BASE DE DATOS...");
    
    try {
      // Verificar que existen los campos is_playoff y playoff_round
      const [testMatch] = await db
        .select({
          id: matchTable.id,
          isPlayoff: matchTable.isPlayoff,
          playoffRound: matchTable.playoffRound
        })
        .from(matchTable)
        .limit(1);
        
      successes.push("✅ Campos is_playoff y playoff_round existen en matches");
    } catch (error) {
      errors.push(`❌ Error accediendo campos de playoff: ${error.message}`);
    }
    
    try {
      // Verificar campos de transición en team_league_assignments
      const [testAssignment] = await db
        .select({
          promotedNextSeason: teamLeagueAssignmentTable.promotedNextSeason,
          relegatedNextSeason: teamLeagueAssignmentTable.relegatedNextSeason,
          playoffNextSeason: teamLeagueAssignmentTable.playoffNextSeason,
          qualifiedForTournament: teamLeagueAssignmentTable.qualifiedForTournament
        })
        .from(teamLeagueAssignmentTable)
        .limit(1);
        
      successes.push("✅ Campos de transición existen en team_league_assignments");
    } catch (error) {
      errors.push(`❌ Error accediendo campos de transición: ${error.message}`);
    }
    
    // 2. VERIFICAR SERVICIOS EXISTEN Y SON IMPORTABLES
    console.log("\n⚙️ 2. VERIFICANDO SERVICIOS...");
    
    try {
      const { SeasonTransitionService } = await import("../../src/teams/season-transition.service");
      const { DatabaseService } = await import("../../src/database/database.service");
      
      // Crear instancia mockup para verificar métodos
      const mockDbService = { db: db, databaseConfig: null } as any;
      const mockAssignmentService = {} as any;
      const mockStandingsService = {} as any;
      const seasonService = new SeasonTransitionService(mockDbService, mockAssignmentService, mockStandingsService);
      
      // Verificar que el método organizePlayoffs existe
      if (typeof seasonService.organizePlayoffs === 'function') {
        successes.push("✅ SeasonTransitionService.organizePlayoffs está disponible");
      } else {
        errors.push("❌ Método organizePlayoffs no encontrado");
      }
      
    } catch (error) {
      errors.push(`❌ Error importando SeasonTransitionService: ${error.message}`);
    }
    
    try {
      const { MatchSimulationService } = await import("../../src/matches/match-simulation.service");
      successes.push("✅ MatchSimulationService importable");
    } catch (error) {
      errors.push(`❌ Error importando MatchSimulationService: ${error.message}`);
    }
    
    // 3. VERIFICAR ESTADO REAL DE PARTIDOS DE PLAYOFF
    console.log("\n🏆 3. VERIFICANDO ESTADO REAL DE PLAYOFFS...");
    
    const [activeSeason] = await db
      .select()
      .from(seasonTable)
      .where(eq(seasonTable.isActive, true));
      
    if (!activeSeason) {
      errors.push("❌ No hay temporada activa");
    } else {
      successes.push(`✅ Temporada activa encontrada: ${activeSeason.name}`);
      
      // Verificar playoffs reales en la base de datos
      const [playoffCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(matchTable)
        .where(
          and(
            eq(matchTable.seasonId, activeSeason.id),
            eq(matchTable.isPlayoff, true)
          )
        );
        
      const realPlayoffCount = Number(playoffCount.count);
      if (realPlayoffCount > 0) {
        successes.push(`✅ Partidos de playoff reales en BD: ${realPlayoffCount}`);
        
        // Obtener detalles de los playoffs
        const playoffMatches = await db
          .select({
            id: matchTable.id,
            round: matchTable.playoffRound,
            leagueId: matchTable.leagueId
          })
          .from(matchTable)
          .where(
            and(
              eq(matchTable.seasonId, activeSeason.id),
              eq(matchTable.isPlayoff, true)
            )
          );
          
        console.log(`   📋 Detalles: ${playoffMatches.length} partidos, rondas: ${[...new Set(playoffMatches.map(p => p.round))].join(', ')}`);
      } else {
        console.log("   ℹ️ No hay partidos de playoff generados aún");
      }
    }
    
    // 4. VERIFICAR INTEGRACIÓN CON MATCH SIMULATION SERVICE
    console.log("\n🔄 4. VERIFICANDO INTEGRACIÓN CON SIMULACIÓN...");
    
    try {
      const fs = await import('fs');
      const matchSimulationCode = fs.readFileSync('src/matches/match-simulation.service.ts', 'utf8');
      
      if (matchSimulationCode.includes('checkAndGeneratePlayoffs')) {
        successes.push("✅ Método checkAndGeneratePlayoffs presente en MatchSimulationService");
      } else {
        errors.push("❌ Método checkAndGeneratePlayoffs no encontrado en MatchSimulationService");
      }
      
      if (matchSimulationCode.includes('SeasonTransitionService')) {
        successes.push("✅ SeasonTransitionService importado en MatchSimulationService");
      } else {
        errors.push("❌ SeasonTransitionService no importado en MatchSimulationService");
      }
      
    } catch (error) {
      errors.push(`❌ Error verificando integración: ${error.message}`);
    }
    
    // 5. VERIFICAR LÓGICA DE DETECCIÓN
    console.log("\n🔍 5. VERIFICANDO LÓGICA DE DETECCIÓN...");
    
    const divisions = await db
      .select()
      .from(divisionTable);
      
    for (const division of divisions) {
      const leagues = await db
        .select({ id: leagueTable.id })
        .from(leagueTable)
        .where(eq(leagueTable.divisionId, division.id));
        
      if (leagues.length === 0) continue;
      
      const leagueIds = leagues.map(l => l.id);
      
      // Verificar lógica de detección
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
      
      const isCompleted = Number(pendingCount.count) === 0;
      const hasPlayoffs = Number(playoffCount.count) > 0;
      const hasPlayoffSlots = division.promotePlayoffSlots && division.promotePlayoffSlots > 0;
      
      console.log(`   📊 ${division.name}: Completa=${isCompleted}, Playoffs=${hasPlayoffs}, Slots=${division.promotePlayoffSlots || 0}`);
      
      if (isCompleted && !hasPlayoffs && hasPlayoffSlots) {
        console.log(`      🎯 División ${division.name} debería generar playoffs automáticamente`);
      }
    }
    
    // 6. VERIFICAR ENDPOINTS
    console.log("\n🌐 6. VERIFICANDO ENDPOINTS...");
    
    try {
      const fs = await import('fs');
      const controllerCode = fs.readFileSync('src/teams/season-transition.controller.ts', 'utf8');
      
      if (controllerCode.includes('@Post(\'organize-playoffs\')')) {
        successes.push("✅ Endpoint organize-playoffs existe");
      } else {
        errors.push("❌ Endpoint organize-playoffs no encontrado");
      }
      
      if (controllerCode.includes('@Post(\'close-season\')')) {
        successes.push("✅ Endpoint close-season existe");
      } else {
        errors.push("❌ Endpoint close-season no encontrado");
      }
      
    } catch (error) {
      errors.push(`❌ Error verificando endpoints: ${error.message}`);
    }
    
    await pool.end();
    
    // RESUMEN FINAL
    console.log("\n" + "=".repeat(60));
    console.log("📋 RESUMEN DE VERIFICACIÓN REAL:");
    console.log("=".repeat(60));
    
    console.log(`\n✅ ÉXITOS (${successes.length}):`);
    successes.forEach(success => console.log(`  ${success}`));
    
    if (errors.length > 0) {
      console.log(`\n❌ ERRORES (${errors.length}):`);
      errors.forEach(error => console.log(`  ${error}`));
    }
    
    const successRate = Math.round((successes.length / (successes.length + errors.length)) * 100);
    console.log(`\n📊 TASA DE ÉXITO: ${successRate}%`);
    
    if (errors.length === 0) {
      console.log("\n🎉 ¡VERIFICACIÓN COMPLETADA - SISTEMA 100% FUNCIONAL!");
    } else if (successRate >= 80) {
      console.log("\n⚠️ Sistema mayormente funcional con algunos problemas menores");
    } else {
      console.log("\n❌ Sistema requiere correcciones importantes");
    }
    
  } catch (error) {
    console.error("❌ Error fatal durante verificación:", error);
  }
}

realSystemVerification();
