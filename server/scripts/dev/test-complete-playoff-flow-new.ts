#!/usr/bin/env ts-node

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { matches } from '../../drizzle/schema';
import { leagues } from '../../drizzle/schema';
import { teams } from '../../drizzle/schema';
import { teamLeagueAssignments } from '../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import axios from 'axios';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/football_manager';
const client = postgres(connectionString);
const db = drizzle(client);

async function testCompletePlayoffFlow() {
  console.log('🚀 Iniciando test completo del flujo de playoffs...\n');
  
  try {
    // 1. Verificar estado inicial
    console.log('1️⃣ Verificando estado inicial...');
    const initialMatches = await db.select().from(matches).where(eq(matches.isPlayoff, true));
    const divisions = await db.select().from(leagues);
    console.log(`   - Partidos de playoff actuales: ${initialMatches.length}`);
    console.log(`   - Divisiones encontradas: ${divisions.length}`);
    
    if (divisions.length === 0) {
      console.log('   ❌ No hay divisiones. Necesitas ejecutar la simulación regular primero.');
      return;
    }
    
    // 2. Buscar División 2 (donde esperamos los playoffs)
    const division2 = divisions.find(d => d.name === 'División 2');
    if (!division2) {
      console.log('   ❌ No se encontró División 2.');
      return;
    }
    
    console.log(`   ✅ División 2 encontrada: ID ${division2.id}`);
    
    // 3. Verificar equipos en División 2
    const teamsInDiv2 = await db.select({
      teamId: teamLeagueAssignments.teamId,
      teamName: teams.name,
      assignmentReason: teamLeagueAssignments.assignmentReason
    })
    .from(teamLeagueAssignments)
    .innerJoin(teams, eq(teamLeagueAssignments.teamId, teams.id))
    .where(eq(teamLeagueAssignments.leagueId, division2.id));
    
    console.log(`\n2️⃣ Equipos en División 2: ${teamsInDiv2.length}`);
    teamsInDiv2.forEach((team, index) => {
      console.log(`   ${index + 1}. ${team.teamName} (Assignment reason: ${team.assignmentReason})`);
    });
    
    // 4. Verificar si ya hay partidos regulares completados
    const regularMatches = await db.select()
      .from(matches)
      .where(
        and(
          eq(matches.leagueId, division2.id),
          eq(matches.isPlayoff, false)
        )
      );
    
    console.log(`\n3️⃣ Partidos regulares en División 2: ${regularMatches.length}`);
    const completedRegular = regularMatches.filter(m => m.homeGoals !== null && m.awayGoals !== null);
    console.log(`   - Completados: ${completedRegular.length}`);
    console.log(`   - Pendientes: ${regularMatches.length - completedRegular.length}`);
    
    // 5. Si no hay suficientes partidos completados, simular algunos
    if (completedRegular.length < regularMatches.length * 0.8) {
      console.log('\n4️⃣ Simulando partidos regulares para preparar playoffs...');
      try {
        const response = await axios.post('http://localhost:3000/api/matches/simulate-all');
        console.log(`   ✅ Simulación completada: ${response.status}`);
      } catch (error) {
        console.log(`   ⚠️ Error al simular: ${error.message}`);
      }
    }
    
    // 6. Obtener clasificación actualizada
    console.log('\n5️⃣ Obteniendo clasificación actual...');
    try {
      const response = await axios.get(`http://localhost:3000/api/teams/leagues/${division2.id}/standings`);
      const standings = response.data;
      console.log('   Clasificación actual:');
      standings.forEach((team: any, index: number) => {
        console.log(`   ${index + 1}. ${team.teamName} - ${team.points} pts (${team.wins}W-${team.draws}D-${team.losses}L)`);
      });
    } catch (error) {
      console.log(`   ⚠️ Error al obtener clasificación: ${error.message}`);
    }
    
    // 7. Intentar generar playoffs
    console.log('\n6️⃣ Intentando generar playoffs...');
    try {
      const response = await axios.post(`http://localhost:3000/api/teams/leagues/${division2.id}/organize-playoffs`);
      console.log(`   ✅ Playoffs organizados: ${response.status}`);
      console.log(`   Respuesta: ${JSON.stringify(response.data, null, 2)}`);
    } catch (error) {
      console.log(`   ⚠️ Error al organizar playoffs: ${error.message}`);
      if (error.response) {
        console.log(`   Detalle del error: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
    
    // 8. Verificar partidos de playoff creados
    console.log('\n7️⃣ Verificando partidos de playoff creados...');
    const playoffMatches = await db.select()
      .from(matches)
      .where(
        and(
          eq(matches.leagueId, division2.id),
          eq(matches.isPlayoff, true)
        )
      )
      .orderBy(matches.playoffRound, matches.matchday);
    
    console.log(`   Total partidos de playoff: ${playoffMatches.length}`);
    
    if (playoffMatches.length > 0) {
      console.log('\n   Detalle de partidos de playoff:');
      playoffMatches.forEach((match, index) => {
        console.log(`   ${index + 1}. Ronda ${match.playoffRound} - Jornada ${match.matchday}`);
        console.log(`      Home: ${match.homeTeamId}, Away: ${match.awayTeamId}`);
        console.log(`      Resultado: ${match.homeGoals !== null ? `${match.homeGoals}-${match.awayGoals}` : 'Sin jugar'}`);
      });
    }
    
    // 9. Si hay partidos de playoff, simular uno
    if (playoffMatches.length > 0) {
      console.log('\n8️⃣ Simulando un partido de playoff...');
      const firstPlayoffMatch = playoffMatches.find(m => m.homeGoals === null);
      
      if (firstPlayoffMatch) {
        try {
          const response = await axios.post(`http://localhost:3000/api/matches/${firstPlayoffMatch.id}/simulate`);
          console.log(`   ✅ Partido simulado: ${response.status}`);
          console.log(`   Resultado: ${JSON.stringify(response.data, null, 2)}`);
          
          // Verificar que no hay empate
          const updatedMatch = await db.select()
            .from(matches)
            .where(eq(matches.id, firstPlayoffMatch.id))
            .limit(1);
          
          if (updatedMatch.length > 0 && updatedMatch[0].homeGoals !== null) {
            const result = updatedMatch[0];
            console.log(`   Resultado final: ${result.homeGoals}-${result.awayGoals}`);
            if (result.homeGoals === result.awayGoals) {
              console.log(`   ❌ ERROR: Playoff terminó en empate (no debería suceder)`);
            } else {
              console.log(`   ✅ Playoff terminó con ganador (correcto)`);
            }
          }
        } catch (error) {
          console.log(`   ⚠️ Error al simular playoff: ${error.message}`);
        }
      } else {
        console.log('   ℹ️ Todos los partidos de playoff ya están simulados');
      }
    }
    
    // 10. Probar endpoint de filtrado de playoffs
    console.log('\n9️⃣ Probando endpoint de filtrado de playoffs...');
    try {
      const response = await axios.get('http://localhost:3000/api/matches?isPlayoff=true');
      console.log(`   ✅ Endpoint funciona: ${response.status}`);
      console.log(`   Partidos de playoff encontrados: ${response.data.length}`);
      
      if (response.data.length > 0) {
        console.log('   Primer partido:');
        const firstMatch = response.data[0];
        console.log(`   - ID: ${firstMatch.id}`);
        console.log(`   - Es playoff: ${firstMatch.isPlayoff}`);
        console.log(`   - Ronda playoff: ${firstMatch.playoffRound}`);
        console.log(`   - Resultado: ${firstMatch.homeGoals !== null ? `${firstMatch.homeGoals}-${firstMatch.awayGoals}` : 'Sin jugar'}`);
      }
    } catch (error) {
      console.log(`   ⚠️ Error al probar endpoint: ${error.message}`);
    }
    
    console.log('\n🎉 Test completo finalizado!');
    
  } catch (error) {
    console.error('❌ Error durante el test:', error);
  } finally {
    await client.end();
  }
}

testCompletePlayoffFlow().catch(console.error);
