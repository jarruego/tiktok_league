import "dotenv/config";

async function testPlayoffGeneration() {
  console.log("=== PRUEBA DE GENERACIÓN AUTOMÁTICA DE PLAYOFFS ===");
  
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
    
    // Obtener información sobre partidos actuales
    const matchesInfo = await db.execute(sql`
      SELECT 
        m.season_id,
        d.name as division_name,
        d.level as division_level,
        l.name as league_name,
        COUNT(*) as total_matches,
        COUNT(CASE WHEN m.status = 'scheduled' AND (m.is_playoff IS NOT TRUE) THEN 1 END) as regular_pending,
        COUNT(CASE WHEN m.status = 'finished' AND (m.is_playoff IS NOT TRUE) THEN 1 END) as regular_finished,
        COUNT(CASE WHEN m.is_playoff = true THEN 1 END) as playoff_matches,
        d.promote_playoff_slots
      FROM matches m
      JOIN leagues l ON m.league_id = l.id
      JOIN divisions d ON l.division_id = d.id
      WHERE m.season_id = (SELECT id FROM seasons WHERE is_active = true LIMIT 1)
      GROUP BY m.season_id, d.id, d.name, d.level, l.name, d.promote_playoff_slots
      ORDER BY d.level, l.name;
    `);
    
    console.log("\n=== ESTADO ACTUAL DE PARTIDOS ===");
    console.log("Division | Liga | Regulares Pendientes | Regulares Finalizados | Partidos Playoff | Slots Playoff");
    console.log("---------|------|----------------------|----------------------|------------------|---------------");
    
    matchesInfo.rows.forEach(row => {
      const division = `Div ${row.division_level}`;
      const league = row.league_name;
      const pending = row.regular_pending || 0;
      const finished = row.regular_finished || 0;
      const playoffs = row.playoff_matches || 0;
      const slots = row.promote_playoff_slots || 0;
      
      console.log(`${division.padEnd(8)} | ${league.padEnd(4)} | ${pending.toString().padEnd(20)} | ${finished.toString().padEnd(20)} | ${playoffs.toString().padEnd(16)} | ${slots.toString().padEnd(13)}`);
      
      // Verificar si la división está completa
      if (pending === 0 && finished > 0 && slots > 0 && playoffs === 0) {
        console.log(`    🎯 ¡División ${row.division_name} está COMPLETA y puede generar playoffs!`);
      } else if (pending === 0 && finished > 0 && playoffs > 0) {
        console.log(`    ✅ División ${row.division_name} ya tiene playoffs generados`);
      } else if (slots === 0) {
        console.log(`    ℹ️  División ${row.division_name} no tiene playoffs configurados`);
      } else if (pending > 0) {
        console.log(`    ⏳ División ${row.division_name} aún tiene ${pending} partidos pendientes`);
      }
    });
    
    // Verificar configuración de playoffs
    console.log("\n=== CONFIGURACIÓN DE PLAYOFFS ===");
    const playoffConfig = await db.execute(sql`
      SELECT 
        name,
        level,
        promote_slots as direct_promotions,
        promote_playoff_slots as playoff_slots,
        relegate_slots as relegations
      FROM divisions
      ORDER BY level;
    `);
    
    playoffConfig.rows.forEach(row => {
      console.log(`${row.name}: Ascensos directos: ${row.direct_promotions}, Playoff slots: ${row.playoff_slots}, Descensos: ${row.relegations}`);
    });
    
    await pool.end();
    console.log("\n✅ Análisis completado");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testPlayoffGeneration();
