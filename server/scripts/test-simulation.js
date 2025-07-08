#!/usr/bin/env node

/**
 * Script de demostración del sistema de simulación de partidos
 * 
 * Este script:
 * 1. Muestra partidos programados para hoy
 * 2. Simula partidos de una fecha específica
 * 3. Muestra estadísticas de simulación
 * 
 * Uso:
 * node test-simulation.js [fecha]
 * 
 * Ejemplo:
 * node test-simulation.js 2025-01-15
 */

const API_BASE = 'http://localhost:3000';

async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      // Nota: En un entorno real necesitarías un token JWT válido
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error ${response.status}: ${error}`);
  }
  
  return response.json();
}

async function showScheduledMatches(date) {
  console.log(`\n🗓️  Partidos programados para ${date}:`);
  console.log('=' .repeat(50));
  
  try {
    const result = await fetchAPI(`/matches?fromDate=${date}&toDate=${date}&status=scheduled`);
    
    if (result.matches.length === 0) {
      console.log('❌ No hay partidos programados para esta fecha');
      return;
    }
    
    result.matches.forEach(match => {
      console.log(`⚽ ${match.homeTeam.name} vs ${match.awayTeam.name}`);
      console.log(`   📍 Liga: ${match.league.name}`);
      console.log(`   📅 Fecha: ${match.scheduledDate}`);
      console.log(`   🆔 ID: ${match.id}`);
      console.log('');
    });
    
    return result.matches;
  } catch (error) {
    console.error('❌ Error obteniendo partidos:', error.message);
    return [];
  }
}

async function simulateMatchesByDate(date) {
  console.log(`\n🎮 Simulando partidos del ${date}...`);
  console.log('=' .repeat(50));
  
  try {
    const results = await fetchAPI('/matches/simulate/date', {
      method: 'POST',
      body: JSON.stringify({ date }),
      headers: {
        // Nota: En un entorno real necesitarías autenticación
        'Authorization': 'Bearer YOUR_JWT_TOKEN'
      }
    });
    
    if (results.length === 0) {
      console.log('ℹ️  No había partidos pendientes para simular');
      return;
    }
    
    console.log(`✅ ${results.length} partidos simulados exitosamente!\n`);
    
    results.forEach(result => {
      console.log(`⚽ ${result.homeTeamName} ${result.homeGoals}-${result.awayGoals} ${result.awayTeamName}`);
      console.log(`   👥 Seguidores: ${result.algorithmDetails.homeTeamFollowers.toLocaleString()} vs ${result.algorithmDetails.awayTeamFollowers.toLocaleString()}`);
      console.log(`   📊 Algoritmo: ${result.algorithmDetails.randomEvents} eventos aleatorios, ${result.algorithmDetails.followerBasedEvents} basados en seguidores`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error simulando partidos:', error.message);
    if (error.message.includes('401') || error.message.includes('403')) {
      console.log('💡 Nota: Este endpoint requiere autenticación JWT');
    }
  }
}

async function showSimulationStats() {
  console.log('\n📊 Estadísticas de simulación:');
  console.log('=' .repeat(50));
  
  try {
    const stats = await fetchAPI('/matches/simulation/stats');
    
    console.log(`📈 Total de partidos: ${stats.totalMatches}`);
    console.log(`⏳ Pendientes: ${stats.scheduledMatches}`);
    console.log(`✅ Finalizados: ${stats.finishedMatches}`);
    console.log(`⚽ Promedio de goles por partido: ${stats.averageGoalsPerMatch?.toFixed(2) || 'N/A'}`);
    console.log(`🏠 Victorias locales: ${stats.homeWins}`);
    console.log(`✈️  Victorias visitantes: ${stats.awayWins}`);
    console.log(`🤝 Empates: ${stats.draws}`);
    
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error.message);
  }
}

async function main() {
  const date = process.argv[2] || new Date().toISOString().split('T')[0];
  
  console.log('🎯 DEMOSTRACIÓN DEL SISTEMA DE SIMULACIÓN DE PARTIDOS');
  console.log('=' .repeat(60));
  console.log(`📅 Fecha objetivo: ${date}`);
  
  // Mostrar partidos programados
  const scheduledMatches = await showScheduledMatches(date);
  
  // Mostrar estadísticas antes de simular
  await showSimulationStats();
  
  // Simular partidos si hay alguno programado
  if (scheduledMatches && scheduledMatches.length > 0) {
    await simulateMatchesByDate(date);
    
    // Mostrar estadísticas después de simular
    await showSimulationStats();
  }
  
  console.log('\n🔄 El sistema ejecuta automáticamente las simulaciones todos los días a las 17:00');
  console.log('⚙️  Para simular manualmente, usa: POST /matches/simulate/date');
  console.log('📚 Para más información, consulta la documentación de la API');
}

// Verificar si estamos en Node.js y tenemos fetch disponible
if (typeof fetch === 'undefined') {
  console.log('❌ Este script requiere Node.js 18+ o importar node-fetch');
  console.log('💡 Instala node-fetch: npm install node-fetch');
  process.exit(1);
}

main().catch(console.error);
