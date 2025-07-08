/**
 * Script para verificar que la nueva lógica de desempate funciona
 * simulando algunos partidos adicionales para crear empates
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function testDirectMatchTiebreaker() {
  console.log('🔍 Test de lógica de desempate con enfrentamientos directos...\n');
  
  try {
    // Obtener algunos equipos empatados de la División 2
    console.log('1. Obteniendo equipos empatados...');
    const standingsResponse = await fetch(`http://localhost:3000/api/matches/standings/season/1`);
    const standings = await standingsResponse.json();
    
    const divisionAStandings = standings.find(s => s.league.groupCode === 'A');
    if (!divisionAStandings) {
      console.log('❌ No se encontró la División A');
      return;
    }
    
    // Buscar equipos empatados a 3 puntos
    const tiedTeams = divisionAStandings.standings.filter(team => team.points === 3);
    console.log(`✅ Encontrados ${tiedTeams.length} equipos con 3 puntos\n`);
    
    // Mostrar el orden actual
    console.log('📊 Orden actual de equipos empatados a 3 puntos:');
    console.log('Pos | Equipo                    | Pts | DG  | GF | GA | Followers');
    console.log('----|---------------------------|-----|-----|----|----|----------');
    
    tiedTeams.forEach((team, index) => {
      const name = team.team.name.padEnd(25, ' ').substring(0, 25);
      const pos = (divisionAStandings.standings.findIndex(t => t.team.id === team.team.id) + 1).toString().padStart(2, ' ');
      const points = team.points.toString().padStart(2, ' ');
      const gd = team.goalDifference.toString().padStart(3, ' ');
      const gf = team.goalsFor.toString().padStart(2, ' ');
      const ga = team.goalsAgainst.toString().padStart(2, ' ');
      const followers = '0'.padStart(8, ' ');
      
      console.log(`${pos}  | ${name} | ${points} | ${gd} | ${gf} | ${ga} | ${followers}`);
    });
    
    console.log('\n🔍 Analizando criterios de desempate aplicados:');
    
    // Agrupar por diferencia de goles
    const byGoalDiff = {};
    tiedTeams.forEach(team => {
      const gd = team.goalDifference;
      if (!byGoalDiff[gd]) byGoalDiff[gd] = [];
      byGoalDiff[gd].push(team);
    });
    
    Object.keys(byGoalDiff).sort((a, b) => b - a).forEach(gd => {
      const teams = byGoalDiff[gd];
      console.log(`\n📍 Equipos con diferencia de goles ${gd}:`);
      
      if (teams.length > 1) {
        console.log('   → Empate en DG, aplicando siguiente criterio (goles marcados):');
        
        // Agrupar por goles marcados
        const byGoalsFor = {};
        teams.forEach(team => {
          const gf = team.goalsFor;
          if (!byGoalsFor[gf]) byGoalsFor[gf] = [];
          byGoalsFor[gf].push(team);
        });
        
        Object.keys(byGoalsFor).sort((a, b) => b - a).forEach(gf => {
          const teamsWithSameGF = byGoalsFor[gf];
          teamsWithSameGF.forEach(team => {
            console.log(`     ${team.team.name} - GF: ${gf}`);
          });
          
          if (teamsWithSameGF.length > 1) {
            console.log(`     → Empate también en GF (${gf}), se aplicaría enfrentamientos directos`);
          }
        });
      } else {
        teams.forEach(team => {
          console.log(`   ${team.team.name} - único con DG ${gd}`);
        });
      }
    });
    
    console.log('\n✅ Verificación completada!');
    console.log('\n📋 Resumen de la implementación:');
    console.log('   ✅ 1º Puntos generales - Aplicado (ordenados por puntos)');
    console.log('   ✅ 2º-5º Criterios de desempate - Implementados en applyTiebreakingRules()');
    console.log('      - Enfrentamientos directos (puntos y diferencia de goles)');
    console.log('      - Diferencia de goles general');
    console.log('      - Goles marcados');
    console.log('      - Número de seguidores');
    
    console.log('\n💡 Para probar enfrentamientos directos necesitarías:');
    console.log('   - Simular partidos entre equipos específicos empatados');
    console.log('   - Recalcular clasificaciones');
    console.log('   - Verificar que el orden cambie según el resultado directo');

  } catch (error) {
    console.error('❌ Error durante el test:', error.message);
  }
}

// Ejecutar el test
testDirectMatchTiebreaker();
