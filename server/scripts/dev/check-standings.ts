#!/usr/bin/env ts-node

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { standings, matches, leagues } from '../../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/football_manager';
const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' || connectionString.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});
const db = drizzle(pool);

async function checkStandings() {
  console.log('🔍 Verificando estado de la tabla standings...\n');
  
  try {
    // Verificar datos en standings
    const standingsData = await db.select().from(standings).limit(10);
    console.log(`📊 Registros en standings: ${standingsData.length}`);
    
    if (standingsData.length > 0) {
      console.log('   Primeros 3 registros:');
      standingsData.slice(0, 3).forEach((standing, index) => {
        console.log(`   ${index + 1}. Liga: ${standing.leagueId}, Equipo: ${standing.teamId}, Posición: ${standing.position}, Puntos: ${standing.points}`);
      });
    } else {
      console.log('   ❌ No hay datos en la tabla standings');
    }
    
    // Verificar ligas
    const leaguesData = await db.select().from(leagues).limit(5);
    console.log(`\n🏆 Ligas encontradas: ${leaguesData.length}`);
    
    if (leaguesData.length > 0) {
      const league2 = leaguesData.find(l => l.name.includes('División 2'));
      if (league2) {
        console.log(`   Liga División 2: ID ${league2.id}`);
        
        // Verificar standings específicos de División 2
        const div2Standings = await db.select()
          .from(standings)
          .where(eq(standings.leagueId, league2.id))
          .limit(10);
          
        console.log(`   Standings en División 2: ${div2Standings.length}`);
        
        if (div2Standings.length === 0) {
          console.log('   ⚠️ No hay standings calculados para División 2');
          console.log('   📝 Esto explica por qué no se generan playoffs');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkStandings().catch(console.error);
