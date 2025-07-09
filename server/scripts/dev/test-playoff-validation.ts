#!/usr/bin/env ts-node

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { 
  matches, 
  leagues, 
  teams, 
  teamLeagueAssignments, 
  divisions,
  seasons,
  standings
} from '../../drizzle/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/football_manager';
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' || databaseUrl.includes('render.com') 
    ? { rejectUnauthorized: false } 
    : false,
});
const db = drizzle(pool);

async function testPlayoffValidation() {
  console.log('🏆 Test de Validación de Playoffs\n');
  console.log('='.repeat(50));
  
  try {
    // 1. Obtener temporada activa
    const [activeSeason] = await db
      .select()
      .from(seasons)
      .where(eq(seasons.isActive, true));
    
    if (!activeSeason) {
      console.log('❌ No hay temporada activa');
      return;
    }
    
    console.log(`📅 Temporada activa: ${activeSeason.name} (ID: ${activeSeason.id})`);
    
    // 2. Verificar configuración según divisionsConfig
    console.log('\n🔧 Verificando configuración de playoffs...');
    
    const expectedPlayoffConfig = [
      { level: 1, name: 'División 1', promotePlayoffSlots: 0 },
      { level: 2, name: 'División 2', promotePlayoffSlots: 4 },
      { level: 3, name: 'División 3', promotePlayoffSlots: 4 },
      { level: 4, name: 'División 4', promotePlayoffSlots: 4 },
      { level: 5, name: 'División 5', promotePlayoffSlots: 8 }
    ];
    
    const divisionsData = await db
      .select()
      .from(divisions)
      .orderBy(divisions.level);
    
    for (const expectedConfig of expectedPlayoffConfig) {
      const division = divisionsData.find(d => d.level === expectedConfig.level);
      
      if (!division) {
        console.log(`❌ División ${expectedConfig.level} no encontrada`);
        continue;
      }
      
      const hasPlayoffs = Number(division.promotePlayoffSlots || 0) > 0;
      const shouldHavePlayoffs = expectedConfig.promotePlayoffSlots > 0;
      
      if (hasPlayoffs === shouldHavePlayoffs) {
        if (hasPlayoffs) {
          console.log(`✅ ${division.name}: ${division.promotePlayoffSlots} equipos en playoff`);
        } else {
          console.log(`✅ ${division.name}: Sin playoffs (correcto)`);
        }
      } else {
        console.log(`❌ ${division.name}: Configuración incorrecta`);
      }
    }
    
    // 3. Validar cada división que debe tener playoffs
    console.log('\n🏟️  Validando divisiones con playoffs...');
    
    for (const division of divisionsData) {
      if (!division.promotePlayoffSlots || division.promotePlayoffSlots <= 0) {
        continue; // Skip divisiones sin playoffs
      }
      
      console.log(`\n📊 Analizando ${division.name}:`);
      
      // Obtener ligas de la división
      const leaguesInDiv = await db
        .select()
        .from(leagues)
        .where(eq(leagues.divisionId, division.id));
      
      console.log(`   🏟️  Ligas: ${leaguesInDiv.length}`);
      
      for (const league of leaguesInDiv) {
        console.log(`\n   📋 Liga: ${league.name}`);
        
        // Verificar equipos en la liga
        const teamsInLeague = await db
          .select({
            teamName: teams.name,
            teamId: teams.id
          })
          .from(teamLeagueAssignments)
          .innerJoin(teams, eq(teamLeagueAssignments.teamId, teams.id))
          .where(
            and(
              eq(teamLeagueAssignments.leagueId, league.id),
              eq(teamLeagueAssignments.seasonId, activeSeason.id)
            )
          );
        
        console.log(`      👥 Equipos: ${teamsInLeague.length}`);
        
        // Verificar partidos regulares
        const regularMatches = await db
          .select()
          .from(matches)
          .where(
            and(
              eq(matches.leagueId, league.id),
              eq(matches.seasonId, activeSeason.id),
              eq(matches.isPlayoff, false)
            )
          );
        
        const completedRegular = regularMatches.filter(m => 
          m.homeGoals !== null && m.awayGoals !== null
        );
        
        const regularComplete = completedRegular.length === regularMatches.length;
        console.log(`      ⚽ Partidos regulares: ${completedRegular.length}/${regularMatches.length} ${regularComplete ? '✅' : '❌'}`);
        
        // Verificar partidos de playoff
        const playoffMatches = await db
          .select()
          .from(matches)
          .where(
            and(
              eq(matches.leagueId, league.id),
              eq(matches.seasonId, activeSeason.id),
              eq(matches.isPlayoff, true)
            )
          );
        
        const completedPlayoffs = playoffMatches.filter(m => 
          m.homeGoals !== null && m.awayGoals !== null
        );
        
        console.log(`      🏆 Partidos playoff: ${completedPlayoffs.length}/${playoffMatches.length}`);
        
        if (regularComplete && playoffMatches.length === 0) {
          console.log(`      🎯 ACCIÓN REQUERIDA: Esta liga está lista para generar playoffs`);
          
          // Mostrar clasificación para contexto
          try {
            const response = await axios.get(`http://localhost:3000/api/teams/leagues/${league.id}/standings`);
            const standings = response.data;
            
            console.log(`      📊 Top 6 clasificación actual:`);
            standings.slice(0, 6).forEach((team: any, index: number) => {
              const isPlayoffPosition = index >= Number(division.promoteSlots || 0) && 
                                      index < Number(division.promoteSlots || 0) + Number(division.promotePlayoffSlots || 0);
              const marker = isPlayoffPosition ? '🏆' : '  ';
              console.log(`         ${marker} ${index + 1}. ${team.teamName} - ${team.points} pts`);
            });
          } catch (error) {
            console.log(`      ⚠️ Error obteniendo clasificación: ${error.message}`);
          }
        }
        
        if (playoffMatches.length > 0) {
          console.log(`      📋 Partidos de playoff programados:`);
          playoffMatches.forEach((match, index) => {
            const status = match.homeGoals !== null && match.awayGoals !== null ? 
              `${match.homeGoals}-${match.awayGoals}` : 'Pendiente';
            console.log(`         ${index + 1}. ${match.playoffRound} - ${status}`);
          });
        }
      }
    }
    
    // 4. Test de generación automática
    console.log('\n🤖 Probando generación automática de playoffs...');
    
    try {
      const response = await axios.post('http://localhost:3000/api/season-transition/test/organize-playoffs');
      const { message, playoffMatches } = response.data;
      
      console.log(`✅ ${message}`);
      console.log(`🎯 Nuevos partidos generados: ${playoffMatches}`);
      
      if (playoffMatches > 0) {
        console.log('\n🎲 ¿Deseas simular los playoffs generados? (Manual)');
        console.log('   Comando: curl -X POST http://localhost:3000/api/matches/simulate-all');
      }
      
    } catch (error) {
      console.log(`❌ Error en generación automática: ${error.response?.data?.message || error.message}`);
    }
    
    // 5. Reporte final de estado
    console.log('\n📋 Generando reporte de estado...');
    
    try {
      const response = await axios.get(`http://localhost:3000/api/season-transition/${activeSeason.id}/closure-report`);
      const report = response.data;
      
      console.log('\n📊 REPORTE DE ESTADO DE TEMPORADA:');
      console.log(`   🔺 Ascensos directos: ${report.promotions.length}`);
      console.log(`   🔻 Descensos directos: ${report.relegations.length}`);
      console.log(`   🏆 Clasificados a torneos: ${report.tournamentQualifiers.length}`);
      console.log(`   ⏳ Playoffs pendientes: ${report.pendingPlayoffs.length}`);
      console.log(`   ❌ Errores: ${report.errors.length}`);
      
      if (report.pendingPlayoffs.length > 0) {
        console.log('\n⏳ Divisiones con playoffs pendientes:');
        report.pendingPlayoffs.forEach((pending: any) => {
          console.log(`   - ${pending.divisionName}: ${pending.teamsCount} equipos`);
        });
      }
      
      if (report.errors.length > 0) {
        console.log('\n❌ Errores encontrados:');
        report.errors.forEach((error: string) => {
          console.log(`   - ${error}`);
        });
      }
      
      // Determinar próximos pasos
      console.log('\n🎯 PRÓXIMOS PASOS:');
      
      if (report.pendingPlayoffs.length > 0) {
        console.log('   1. Completar playoffs pendientes');
        console.log('   2. Simular partidos de playoff');
        console.log('   3. Volver a generar reporte');
      } else if (report.errors.length > 0) {
        console.log('   1. Resolver errores encontrados');
        console.log('   2. Verificar temporada regular completa');
      } else {
        console.log('   1. ✅ Temporada lista para cierre');
        console.log('   2. Ejecutar transición de temporada');
        console.log('   3. Crear nueva temporada');
      }
      
    } catch (error) {
      console.log(`❌ Error obteniendo reporte: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Test de validación completado');
    
  } catch (error) {
    console.error('💥 Error en el test:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar si este archivo se ejecuta directamente
if (require.main === module) {
  testPlayoffValidation()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Error ejecutando test:', error);
      process.exit(1);
    });
}

export { testPlayoffValidation };
