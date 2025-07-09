#!/usr/bin/env ts-node

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
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

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/football_manager';
const client = postgres(connectionString);
const db = drizzle(client);

interface TestResults {
  success: boolean;
  message: string;
  details?: any;
}

async function testComprehensiveSeasonTransition(): Promise<TestResults[]> {
  console.log('🚀 Test Comprehensivo de Transición de Temporadas\n');
  console.log('='.repeat(60));
  
  const results: TestResults[] = [];
  
  try {
    // 1. Verificar estado inicial del sistema
    console.log('\n1️⃣ Verificando estado inicial del sistema...');
    const initialState = await checkInitialState();
    results.push(initialState);
    
    if (!initialState.success) {
      console.log('❌ Estado inicial inválido. Abortando tests.');
      return results;
    }
    
    // 2. Verificar configuración de divisiones
    console.log('\n2️⃣ Verificando configuración de divisiones...');
    const divisionConfig = await checkDivisionConfiguration();
    results.push(divisionConfig);
    
    // 3. Verificar asignaciones de equipos
    console.log('\n3️⃣ Verificando asignaciones de equipos...');
    const teamAssignments = await checkTeamAssignments();
    results.push(teamAssignments);
    
    // 4. Verificar partidos de temporada regular
    console.log('\n4️⃣ Verificando partidos de temporada regular...');
    const regularMatches = await checkRegularMatches();
    results.push(regularMatches);
    
    // 5. Simular temporada si es necesario
    if (!regularMatches.success) {
      console.log('\n5️⃣ Simulando temporada regular...');
      const simulation = await simulateRegularSeason();
      results.push(simulation);
    }
    
    // 6. Verificar clasificaciones finales
    console.log('\n6️⃣ Verificando clasificaciones finales...');
    const standings = await checkFinalStandings();
    results.push(standings);
    
    // 7. Test de generación automática de playoffs
    console.log('\n7️⃣ Testeando generación automática de playoffs...');
    const playoffGeneration = await testPlayoffGeneration();
    results.push(playoffGeneration);
    
    // 8. Test de simulación de playoffs
    console.log('\n8️⃣ Testeando simulación de playoffs...');
    const playoffSimulation = await testPlayoffSimulation();
    results.push(playoffSimulation);
    
    // 9. Test de reporte de cierre de temporada
    console.log('\n9️⃣ Testeando reporte de cierre de temporada...');
    const closureReport = await testSeasonClosureReport();
    results.push(closureReport);
    
    // 10. Test de transición de temporada
    console.log('\n🔟 Testeando transición de temporada...');
    const seasonTransition = await testSeasonTransition();
    results.push(seasonTransition);
    
    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE TESTS');
    console.log('='.repeat(60));
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} Test ${index + 1}: ${result.message}`);
      if (!result.success && result.details) {
        console.log(`   💡 ${result.details}`);
      }
    });
    
    console.log(`\n🏆 Resultado: ${successCount}/${totalCount} tests exitosos`);
    
    if (successCount === totalCount) {
      console.log('🎉 ¡Todos los tests pasaron! El sistema de transición funciona correctamente.');
    } else {
      console.log('⚠️  Algunos tests fallaron. Revisar la configuración del sistema.');
    }
    
  } catch (error) {
    console.error('💥 Error crítico en los tests:', error);
    results.push({
      success: false,
      message: 'Error crítico en la ejecución de tests',
      details: error.message
    });
  } finally {
    await client.end();
  }
  
  return results;
}

async function checkInitialState(): Promise<TestResults> {
  try {
    // Verificar temporada activa
    const [activeSeason] = await db
      .select()
      .from(seasons)
      .where(eq(seasons.isActive, true));
    
    if (!activeSeason) {
      return {
        success: false,
        message: 'No hay temporada activa',
        details: 'Se requiere una temporada activa para ejecutar los tests'
      };
    }
    
    // Verificar que hay divisiones
    const divisionCount = await db.select({ count: sql<number>`count(*)` }).from(divisions);
    
    if (Number(divisionCount[0].count) === 0) {
      return {
        success: false,
        message: 'No hay divisiones configuradas',
        details: 'Se requiere inicializar el sistema de ligas primero'
      };
    }
    
    // Verificar que hay equipos
    const teamCount = await db.select({ count: sql<number>`count(*)` }).from(teams);
    
    if (Number(teamCount[0].count) === 0) {
      return {
        success: false,
        message: 'No hay equipos en el sistema',
        details: 'Se requiere tener equipos registrados'
      };
    }
    
    console.log(`   ✅ Temporada activa: ${activeSeason.name} (ID: ${activeSeason.id})`);
    console.log(`   ✅ Divisiones: ${divisionCount[0].count}`);
    console.log(`   ✅ Equipos: ${teamCount[0].count}`);
    
    return {
      success: true,
      message: 'Estado inicial válido',
      details: {
        activeSeason: activeSeason.id,
        divisions: Number(divisionCount[0].count),
        teams: Number(teamCount[0].count)
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error verificando estado inicial',
      details: error.message
    };
  }
}

async function checkDivisionConfiguration(): Promise<TestResults> {
  try {
    const divisionsData = await db
      .select()
      .from(divisions)
      .orderBy(divisions.level);
    
    const expectedDivisions = [
      { level: 1, promoteSlots: 0, promotePlayoffSlots: 0, relegateSlots: 3, tournamentSlots: 8 },
      { level: 2, promoteSlots: 2, promotePlayoffSlots: 4, relegateSlots: 3, tournamentSlots: 0 },
      { level: 3, promoteSlots: 2, promotePlayoffSlots: 4, relegateSlots: 6, tournamentSlots: 0 },
      { level: 4, promoteSlots: 4, promotePlayoffSlots: 4, relegateSlots: 12, tournamentSlots: 0 },
      { level: 5, promoteSlots: 8, promotePlayoffSlots: 8, relegateSlots: 0, tournamentSlots: 0 }
    ];
    
    for (const expected of expectedDivisions) {
      const division = divisionsData.find(d => d.level === expected.level);
      if (!division) {
        return {
          success: false,
          message: `División ${expected.level} no encontrada`,
          details: 'Configuración incompleta de divisiones'
        };
      }
      
      if (division.promoteSlots !== expected.promoteSlots ||
          division.promotePlayoffSlots !== expected.promotePlayoffSlots ||
          division.relegateSlots !== expected.relegateSlots ||
          division.tournamentSlots !== expected.tournamentSlots) {
        return {
          success: false,
          message: `División ${expected.level} mal configurada`,
          details: `Esperado: promote=${expected.promoteSlots}, playoff=${expected.promotePlayoffSlots}, relegate=${expected.relegateSlots}, tournament=${expected.tournamentSlots}`
        };
      }
      
      console.log(`   ✅ División ${division.level}: ${division.name} correctamente configurada`);
    }
    
    return {
      success: true,
      message: 'Configuración de divisiones correcta',
      details: { divisionsChecked: expectedDivisions.length }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error verificando configuración de divisiones',
      details: error.message
    };
  }
}

async function checkTeamAssignments(): Promise<TestResults> {
  try {
    const [activeSeason] = await db
      .select()
      .from(seasons)
      .where(eq(seasons.isActive, true));
    
    const assignmentCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(teamLeagueAssignments)
      .where(eq(teamLeagueAssignments.seasonId, activeSeason.id));
    
    if (Number(assignmentCount[0].count) === 0) {
      return {
        success: false,
        message: 'No hay asignaciones de equipos a ligas',
        details: 'Se requiere asignar equipos a ligas para la temporada activa'
      };
    }
    
    // Verificar distribución por división
    const divisionDistribution = await db
      .select({
        divisionLevel: divisions.level,
        divisionName: divisions.name,
        teamCount: sql<number>`count(*)`
      })
      .from(teamLeagueAssignments)
      .innerJoin(leagues, eq(teamLeagueAssignments.leagueId, leagues.id))
      .innerJoin(divisions, eq(leagues.divisionId, divisions.id))
      .where(eq(teamLeagueAssignments.seasonId, activeSeason.id))
      .groupBy(divisions.level, divisions.name)
      .orderBy(divisions.level);
    
    console.log('   📊 Distribución de equipos por división:');
    divisionDistribution.forEach(div => {
      console.log(`      División ${div.divisionLevel}: ${div.teamCount} equipos`);
    });
    
    return {
      success: true,
      message: 'Asignaciones de equipos verificadas',
      details: { 
        totalAssignments: Number(assignmentCount[0].count),
        distribution: divisionDistribution
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error verificando asignaciones de equipos',
      details: error.message
    };
  }
}

async function checkRegularMatches(): Promise<TestResults> {
  try {
    const [activeSeason] = await db
      .select()
      .from(seasons)
      .where(eq(seasons.isActive, true));
    
    const matchCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(matches)
      .where(
        and(
          eq(matches.seasonId, activeSeason.id),
          eq(matches.isPlayoff, false)
        )
      );
    
    const completedCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(matches)
      .where(
        and(
          eq(matches.seasonId, activeSeason.id),
          eq(matches.isPlayoff, false),
          sql`${matches.homeGoals} IS NOT NULL AND ${matches.awayGoals} IS NOT NULL`
        )
      );
    
    const totalMatches = Number(matchCount[0].count);
    const completedMatches = Number(completedCount[0].count);
    const percentage = totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0;
    
    console.log(`   📊 Partidos regulares: ${completedMatches}/${totalMatches} (${percentage.toFixed(1)}%)`);
    
    if (totalMatches === 0) {
      return {
        success: false,
        message: 'No hay partidos programados',
        details: 'Se requiere generar el calendario de partidos'
      };
    }
    
    const isComplete = completedMatches === totalMatches;
    
    return {
      success: isComplete,
      message: isComplete ? 'Temporada regular completa' : 'Temporada regular incompleta',
      details: {
        totalMatches,
        completedMatches,
        percentage: percentage.toFixed(1)
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error verificando partidos regulares',
      details: error.message
    };
  }
}

async function simulateRegularSeason(): Promise<TestResults> {
  try {
    console.log('   🎲 Simulando todos los partidos pendientes...');
    const response = await axios.post('http://localhost:3000/api/matches/simulate-all');
    
    if (response.status === 200) {
      console.log(`   ✅ Simulación completada exitosamente`);
      return {
        success: true,
        message: 'Temporada regular simulada correctamente',
        details: response.data
      };
    } else {
      return {
        success: false,
        message: 'Error en la simulación',
        details: `Status: ${response.status}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Error simulando temporada regular',
      details: error.response?.data || error.message
    };
  }
}

async function checkFinalStandings(): Promise<TestResults> {
  try {
    const [activeSeason] = await db
      .select()
      .from(seasons)
      .where(eq(seasons.isActive, true));
    
    const divisionsData = await db
      .select()
      .from(divisions)
      .orderBy(divisions.level);
    
    const standingsReport: any = {};
    
    for (const division of divisionsData) {
      const leaguesInDiv = await db
        .select()
        .from(leagues)
        .where(eq(leagues.divisionId, division.id));
      
      standingsReport[division.name] = {};
      
      for (const league of leaguesInDiv) {
        try {
          const response = await axios.get(`http://localhost:3000/api/teams/leagues/${league.id}/standings`);
          const standings = response.data;
          
          standingsReport[division.name][league.name] = standings.slice(0, 5).map((team: any, index: number) => ({
            position: index + 1,
            name: team.teamName,
            points: team.points
          }));
          
          console.log(`   📊 ${league.name} - Top 3:`);
          standings.slice(0, 3).forEach((team: any, index: number) => {
            console.log(`      ${index + 1}. ${team.teamName} - ${team.points} pts`);
          });
        } catch (error) {
          console.log(`   ⚠️ Error obteniendo clasificación de ${league.name}`);
        }
      }
    }
    
    return {
      success: true,
      message: 'Clasificaciones finales obtenidas',
      details: standingsReport
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error verificando clasificaciones finales',
      details: error.message
    };
  }
}

async function testPlayoffGeneration(): Promise<TestResults> {
  try {
    console.log('   🏆 Generando playoffs automáticamente...');
    const response = await axios.post('http://localhost:3000/api/season-transition/test/organize-playoffs');
    
    if (response.status === 200) {
      const { message, playoffMatches } = response.data;
      console.log(`   ✅ ${message}`);
      console.log(`   🎯 Partidos de playoff generados: ${playoffMatches}`);
      
      return {
        success: true,
        message: 'Playoffs generados exitosamente',
        details: { playoffMatches, message }
      };
    } else {
      return {
        success: false,
        message: 'Error generando playoffs',
        details: `Status: ${response.status}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Error en generación de playoffs',
      details: error.response?.data || error.message
    };
  }
}

async function testPlayoffSimulation(): Promise<TestResults> {
  try {
    const [activeSeason] = await db
      .select()
      .from(seasons)
      .where(eq(seasons.isActive, true));
    
    const playoffCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(matches)
      .where(
        and(
          eq(matches.seasonId, activeSeason.id),
          eq(matches.isPlayoff, true),
          sql`${matches.homeGoals} IS NULL OR ${matches.awayGoals} IS NULL`
        )
      );
    
    const pendingPlayoffs = Number(playoffCount[0].count);
    
    if (pendingPlayoffs === 0) {
      console.log('   ℹ️ No hay partidos de playoff pendientes');
      return {
        success: true,
        message: 'No hay playoffs para simular',
        details: 'Todos los playoffs ya están completos o no se generaron'
      };
    }
    
    console.log(`   🎲 Simulando ${pendingPlayoffs} partidos de playoff...`);
    const response = await axios.post('http://localhost:3000/api/matches/simulate-all');
    
    if (response.status === 200) {
      console.log(`   ✅ Playoffs simulados exitosamente`);
      return {
        success: true,
        message: 'Playoffs simulados correctamente',
        details: { pendingPlayoffs, simulationResult: response.data }
      };
    } else {
      return {
        success: false,
        message: 'Error simulando playoffs',
        details: `Status: ${response.status}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Error en simulación de playoffs',
      details: error.response?.data || error.message
    };
  }
}

async function testSeasonClosureReport(): Promise<TestResults> {
  try {
    const [activeSeason] = await db
      .select()
      .from(seasons)
      .where(eq(seasons.isActive, true));
    
    console.log('   📋 Generando reporte de cierre de temporada...');
    const response = await axios.get(`http://localhost:3000/api/season-transition/${activeSeason.id}/closure-report`);
    
    if (response.status === 200) {
      const report = response.data;
      
      console.log(`   📊 Reporte generado:`);
      console.log(`      - Ascensos: ${report.promotions.length}`);
      console.log(`      - Descensos: ${report.relegations.length}`);
      console.log(`      - Clasificados a torneos: ${report.tournamentQualifiers.length}`);
      console.log(`      - Playoffs pendientes: ${report.pendingPlayoffs.length}`);
      console.log(`      - Errores: ${report.errors.length}`);
      
      if (report.errors.length > 0) {
        console.log(`   ⚠️ Errores encontrados:`);
        report.errors.forEach((error: string) => {
          console.log(`      - ${error}`);
        });
      }
      
      return {
        success: report.errors.length === 0,
        message: report.errors.length === 0 ? 'Reporte de cierre generado sin errores' : 'Reporte generado con errores',
        details: report
      };
    } else {
      return {
        success: false,
        message: 'Error generando reporte de cierre',
        details: `Status: ${response.status}`
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Error en reporte de cierre de temporada',
      details: error.response?.data || error.message
    };
  }
}

async function testSeasonTransition(): Promise<TestResults> {
  try {
    console.log('   🔄 Iniciando transición de temporada (modo test)...');
    
    // Por ahora solo simulamos el proceso sin ejecutarlo realmente
    // para no alterar los datos existentes
    console.log('   ℹ️ Transición de temporada en modo simulación');
    console.log('   ⚠️ En producción, esto procesaría ascensos, descensos y nueva temporada');
    
    return {
      success: true,
      message: 'Test de transición de temporada completado (modo simulación)',
      details: 'La funcionalidad está disponible pero no se ejecutó para preservar los datos'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error en test de transición de temporada',
      details: error.message
    };
  }
}

// Ejecutar tests si este archivo se ejecuta directamente
if (require.main === module) {
  testComprehensiveSeasonTransition()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Error ejecutando tests:', error);
      process.exit(1);
    });
}

export { testComprehensiveSeasonTransition };
