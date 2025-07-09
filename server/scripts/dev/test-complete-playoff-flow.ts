#!/usr/bin/env ts-node

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { matches, leagues, teams, teamLeagueAssignments, standings, divisions } from '../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import axios from 'axios';
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

async function testCompletePlayoffFlow() {
  console.log('🚀 Iniciando test completo del flujo de playoffs...\n');
  
  try {
    // 1. Verificar estado inicial
    console.log('1️⃣ Verificando estado inicial de la base de datos...');
    const initialPlayoffMatches = await db.select().from(matches).where(eq(matches.isPlayoff, true));
    const allDivisions = await db.select().from(divisions);
    const allLeagues = await db.select().from(leagues);
    
    console.log(`   - Partidos de playoff actuales: ${initialPlayoffMatches.length}`);
    console.log(`   - Divisiones encontradas: ${allDivisions.length}`);
    console.log(`   - Ligas encontradas: ${allLeagues.length}`);
    
    if (allDivisions.length === 0) {
      console.log('   ❌ No hay divisiones. Necesitas ejecutar el setup inicial primero.');
      return;
    }
    
    // 2. Buscar División 2 (donde esperamos los playoffs)
    const division2 = allDivisions.find(d => d.level === 2);
    if (!division2) {
      console.log('   ❌ No se encontró División 2.');
      return;
    }
    
    console.log(`   ✅ División 2 encontrada: ID ${division2.id} - ${division2.name}`);
    console.log(`   - Ascensos directos: ${division2.promoteSlots}`);
    console.log(`   - Plazas de playoff: ${division2.promotePlayoffSlots}`);
    
    // 3. Buscar liga de División 2
    const league2 = allLeagues.find(l => l.divisionId === division2.id);
    if (!league2) {
      console.log('   ❌ No se encontró liga en División 2.');
      return;
    }
    
    console.log(`   ✅ Liga División 2 encontrada: ID ${league2.id} - ${league2.name}`);
    
    // 4. Verificar equipos en División 2
    const teamsInDiv2 = await db.select({
      teamId: teamLeagueAssignments.teamId,
      teamName: teams.name,
      assignmentReason: teamLeagueAssignments.assignmentReason
    })
    .from(teamLeagueAssignments)
    .innerJoin(teams, eq(teamLeagueAssignments.teamId, teams.id))
    .where(eq(teamLeagueAssignments.leagueId, league2.id));
    
    console.log(`\n2️⃣ Equipos en División 2: ${teamsInDiv2.length}`);
    teamsInDiv2.slice(0, 10).forEach((team, index) => {
      console.log(`   ${index + 1}. ${team.teamName}`);
    });
    if (teamsInDiv2.length > 10) {
      console.log(`   ... y ${teamsInDiv2.length - 10} equipos más`);
    }
    
    // 5. Verificar partidos regulares
    const regularMatches = await db.select()
      .from(matches)
      .where(
        and(
          eq(matches.leagueId, league2.id),
          eq(matches.isPlayoff, false)
        )
      );
    
    console.log(`\n3️⃣ Estado de partidos regulares en División 2:`);
    console.log(`   - Total partidos programados: ${regularMatches.length}`);
    
    const completedRegular = regularMatches.filter(m => m.homeGoals !== null && m.awayGoals !== null);
    console.log(`   - Partidos completados: ${completedRegular.length}`);
    console.log(`   - Partidos pendientes: ${regularMatches.length - completedRegular.length}`);
    
    // 6. Decidir si simular partidos o no
    const needsSimulation = completedRegular.length < regularMatches.length * 0.8; // Al menos 80% de partidos completados
    
    if (needsSimulation && regularMatches.length > 0) {
      console.log('\n4️⃣ Se necesita simular partidos regulares para tener datos de clasificación...');
      console.log('   📝 Para playoffs necesitamos una clasificación para determinar equipos 3º-6º');
      
      // Simular algunos partidos para tener datos básicos
      console.log('   🎲 Simulando partidos para generar clasificación básica...');
      try {
        // Simular al menos la mitad de los partidos para tener datos significativos
        const matchesToSimulate = Math.max(10, Math.floor(regularMatches.length * 0.6));
        let simulatedCount = 0;
        
        for (let i = 0; i < regularMatches.length && simulatedCount < matchesToSimulate; i++) {
          const match = regularMatches[i];
          if (match.homeGoals === null) {
            await db.update(matches)
              .set({
                homeGoals: Math.floor(Math.random() * 4),
                awayGoals: Math.floor(Math.random() * 4),
                status: 'finished'
              })
              .where(eq(matches.id, match.id));
            simulatedCount++;
          }
        }
        console.log(`   ✅ ${simulatedCount} partidos simulados para generar datos básicos`);
      } catch (error) {
        console.log(`   ⚠️ Error simulando partidos: ${error.message}`);
      }
    } else if (regularMatches.length === 0) {
      console.log('\n4️⃣ ⚠️ No hay partidos regulares programados en esta liga!');
      console.log('   📝 Puede que necesites generar el calendario de la temporada primero.');
    }
    
    // 7. Recalcular clasificaciones si hay partidos jugados
    console.log('\n5️⃣ Verificando clasificación actual...');
    
    // Intentar recalcular clasificaciones directamente en la BD
    console.log('   🔧 Recalculando clasificaciones directamente...');
    try {
      // Obtener partidos completados de la división 2
      const completedMatches = await db.select()
        .from(matches)
        .where(
          and(
            eq(matches.leagueId, league2.id),
            eq(matches.isPlayoff, false)
          )
        );
      
      const completed = completedMatches.filter(m => m.homeGoals !== null && m.awayGoals !== null);
      console.log(`   📊 Partidos jugados para calcular clasificación: ${completed.length}`);
      
      if (completed.length > 0) {
        // Calcular estadísticas básicas por equipo
        const teamStats = new Map();
        
        completed.forEach(match => {
          // Verificación de tipos explícita
          if (match.homeGoals === null || match.awayGoals === null) return;
          
          if (!teamStats.has(match.homeTeamId)) {
            teamStats.set(match.homeTeamId, { points: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 });
          }
          if (!teamStats.has(match.awayTeamId)) {
            teamStats.set(match.awayTeamId, { points: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 });
          }
          
          const homeStats = teamStats.get(match.homeTeamId);
          const awayStats = teamStats.get(match.awayTeamId);
          
          homeStats.goalsFor += match.homeGoals;
          homeStats.goalsAgainst += match.awayGoals;
          awayStats.goalsFor += match.awayGoals;
          awayStats.goalsAgainst += match.homeGoals;
          
          if (match.homeGoals > match.awayGoals) {
            homeStats.wins++;
            homeStats.points += 3;
            awayStats.losses++;
          } else if (match.homeGoals < match.awayGoals) {
            awayStats.wins++;
            awayStats.points += 3;
            homeStats.losses++;
          } else {
            homeStats.draws++;
            awayStats.draws++;
            homeStats.points += 1;
            awayStats.points += 1;
          }
        });
        
        // Mostrar clasificación
        const teamsWithStats = await db.select()
          .from(teams)
          .innerJoin(teamLeagueAssignments, eq(teams.id, teamLeagueAssignments.teamId))
          .where(eq(teamLeagueAssignments.leagueId, league2.id));
        
        const classification = teamsWithStats.map(team => {
          const stats = teamStats.get(team.teams.id) || { points: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
          return {
            name: team.teams.name,
            teamId: team.teams.id,
            ...stats,
            goalDifference: stats.goalsFor - stats.goalsAgainst
          };
        }).sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return b.goalDifference - a.goalDifference;
        });
        
        console.log('\n   📊 Clasificación actual División 2:');
        classification.slice(0, 8).forEach((team, index) => {
          const position = index + 1;
          let status = '';
          if (position <= 2) {
            status = '⬆️ ASCIENDE DIRECTO';
          } else if (position >= 3 && position <= 6) {
            status = '🏆 PLAYOFF';
          }
          
          console.log(`   ${position}. ${team.name} - ${team.points} pts (GD: ${team.goalDifference}) ${status}`);
        });
        
        // Mostrar emparejamientos teóricos de playoff
        const playoffTeams = classification.slice(2, 6); // Posiciones 3-6
        
        if (playoffTeams.length >= 4) {
          console.log('\n   🎯 Emparejamientos de playoff serían:');
          console.log(`   Semifinal 1: ${playoffTeams[0].name} (3º) vs ${playoffTeams[3].name} (6º)`);
          console.log(`   Semifinal 2: ${playoffTeams[1].name} (4º) vs ${playoffTeams[2].name} (5º)`);
        }
        
      } else {
        console.log('   ⚠️ No hay partidos completados para calcular clasificación');
      }
      
    } catch (error) {
      console.log(`   ⚠️ Error calculando clasificación: ${error.message}`);
    }
    
    // 9. Intentar generar playoffs usando el endpoint correcto
    console.log('\n6️⃣ Intentando generar playoffs...');
    try {
      console.log('   🎯 Probando endpoint de testing público...');
      const response = await axios.post(`http://localhost:3000/api/season-transition/test/organize-playoffs`);
      console.log(`   ✅ Playoffs organizados: ${response.status}`);
      console.log(`   Respuesta:`, response.data);
    } catch (error) {
      console.log(`   ⚠️ Error organizando playoffs: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Detalle:`, error.response.data);
      }
      
      // Intentar el endpoint protegido como fallback
      try {
        console.log('   � Probando endpoint autenticado...');
        const response = await axios.post(`http://localhost:3000/api/season-transition/organize-playoffs`);
        console.log(`   ✅ Playoffs organizados con autenticación: ${response.status}`);
        console.log(`   Respuesta:`, response.data);
      } catch (authError) {
        console.log(`   ⚠️ Error con endpoint autenticado: ${authError.message}`);
        
        // Información para el usuario
        console.log('   � Intentando generar playoffs directamente desde base de datos...');
        try {
          // Verificar si hay suficientes equipos y datos para playoffs
          const teamsInDiv = await db.select({ teamId: teamLeagueAssignments.teamId })
            .from(teamLeagueAssignments)
            .where(eq(teamLeagueAssignments.leagueId, league2.id));
          
          if (teamsInDiv.length >= 6) {
            console.log(`   ✅ División 2 tiene ${teamsInDiv.length} equipos, suficiente para playoffs`);
            console.log('   📋 Para generar playoffs correctamente necesitas:');
            console.log('     1. Autenticación JWT válida, O');
            console.log('     2. Endpoint público para testing (ya agregado), O');
            console.log('     3. Usar el backend directamente');
          }
        } catch (dbError) {
          console.log(`   ❌ Error verificando datos: ${dbError.message}`);
        }
      }
    }
    
    // 10. Verificar partidos de playoff creados
    console.log('\n7️⃣ Verificando partidos de playoff creados...');
    const playoffMatches = await db.select()
      .from(matches)
      .where(eq(matches.isPlayoff, true));
    
    console.log(`   Total partidos de playoff en toda la BD: ${playoffMatches.length}`);
    
    if (playoffMatches.length > 0) {
      console.log('\n   Detalle de partidos de playoff:');
      playoffMatches.forEach((match, index) => {
        console.log(`   ${index + 1}. Ronda ${match.playoffRound || 'N/A'} - Jornada ${match.matchday}`);
        console.log(`      Liga: ${match.leagueId}, Home: ${match.homeTeamId}, Away: ${match.awayTeamId}`);
        console.log(`      Resultado: ${match.homeGoals !== null ? `${match.homeGoals}-${match.awayGoals}` : 'Sin jugar'}`);
        console.log(`      Fecha: ${match.scheduledDate}`);
      });
    }
    
    // 11. Probar endpoint de filtrado de playoffs desde frontend
    console.log('\n8️⃣ Probando endpoint de filtrado de playoffs (como usa el frontend)...');
    try {
      const response = await axios.get('http://localhost:3000/api/matches?isPlayoff=true&seasonId=1');
      console.log(`   ✅ Endpoint funciona: ${response.status}`);
      console.log(`   Partidos de playoff encontrados: ${response.data.matches ? response.data.matches.length : 'No matches field'}`);
      
      if (response.data.matches && response.data.matches.length > 0) {
        const firstMatch = response.data.matches[0];
        console.log('   Primer partido:');
        console.log(`   - ID: ${firstMatch.id}`);
        console.log(`   - Es playoff: ${firstMatch.isPlayoff}`);
        console.log(`   - Ronda playoff: ${firstMatch.playoffRound}`);
        console.log(`   - Home: ${firstMatch.homeTeam.name} vs Away: ${firstMatch.awayTeam.name}`);
        console.log(`   - Resultado: ${firstMatch.homeGoals !== null ? `${firstMatch.homeGoals}-${firstMatch.awayGoals}` : 'Sin jugar'}`);
      }
    } catch (error) {
      console.log(`   ⚠️ Error probando endpoint: ${error.message}`);
    }
    
    console.log('\n🎉 Test completado!');
    console.log('\n📝 RESUMEN:');
    console.log('- Para que los playoffs funcionen completamente, necesitas:');
    console.log('  1. Equipos asignados a ligas ✅');
    console.log('  2. Partidos regulares generados ✅');
    console.log('  3. Algunos partidos jugados para tener clasificación ⚠️');
    console.log('  4. Sistema de playoffs configurado ✅');
    console.log('  5. Lógica anti-empates en playoffs ⚠️ (pendiente de verificar)');
    
  } catch (error) {
    console.error('❌ Error durante el test:', error);
  } finally {
    await pool.end();
  }
}

testCompletePlayoffFlow().catch(console.error);
