/**
 * Script para depurar paso a paso la lógica de desempate
 */

async function testTiebreakerDetailed() {
  console.log('🔍 Depuración detallada de la lógica de desempate...\n');
  
  try {
    // Obtener clasificaciones actuales
    const response = await fetch(`http://localhost:3000/api/matches/standings/season/1`);
    const standings = await response.json();
    
    const divisionA = standings.find(s => s.league.groupCode === 'A');
    if (!divisionA) {
      console.log('❌ No se encontró la División A');
      return;
    }
    
    // Analizar equipos empatados a 4 puntos (donde hay diferencias)
    const fourPointTeams = divisionA.standings.filter(team => team.points === 4);
    console.log('📊 Equipos empatados a 4 puntos:');
    console.log('Pos | Equipo                    | Pts | DG  | GF | GA');
    console.log('----|---------------------------|-----|-----|----|----|');
    
    fourPointTeams.forEach(team => {
      const name = team.team.name.padEnd(25, ' ').substring(0, 25);
      const pos = team.position.toString().padStart(2, ' ');
      const points = team.points.toString().padStart(2, ' ');
      const gd = team.goalDifference.toString().padStart(3, ' ');
      const gf = team.goalsFor.toString().padStart(2, ' ');
      const ga = team.goalsAgainst.toString().padStart(2, ' ');
      
      console.log(`${pos}  | ${name} | ${points} | ${gd} | ${gf} | ${ga}`);
    });
    
    console.log('\n🎯 Análisis según criterios de desempate:');
    console.log('1. Puntos: Todos empatados a 4');
    console.log('2. Enfrentamientos directos: (necesitaríamos verificar partidos)');
    console.log('3. Diferencia de goles general:');
    
    const sortedByGD = [...fourPointTeams].sort((a, b) => b.goalDifference - a.goalDifference);
    sortedByGD.forEach((team, index) => {
      console.log(`   ${index + 1}. ${team.team.name} - DG: ${team.goalDifference}`);
    });
    
    console.log('\n4. En caso de empate en DG, goles marcados:');
    
    // Agrupar por diferencia de goles
    const gdGroups = new Map();
    fourPointTeams.forEach(team => {
      const gd = team.goalDifference;
      if (!gdGroups.has(gd)) {
        gdGroups.set(gd, []);
      }
      gdGroups.get(gd).push(team);
    });
    
    Array.from(gdGroups.entries())
      .sort(([a], [b]) => b - a)
      .forEach(([gd, teams]) => {
        console.log(`\n   Equipos con DG ${gd}:`);
        const sortedByGF = teams.sort((a, b) => b.goalsFor - a.goalsFor);
        sortedByGF.forEach((team, index) => {
          console.log(`     ${index + 1}. ${team.team.name} - GF: ${team.goalsFor}`);
        });
      });
    
    console.log('\n🔧 Orden esperado basado en la lógica:');
    const manualOrder = fourPointTeams.sort((a, b) => {
      // 3. Diferencia de goles general
      if (a.goalDifference !== b.goalDifference) {
        return b.goalDifference - a.goalDifference;
      }
      
      // 4. Goles marcados
      if (a.goalsFor !== b.goalsFor) {
        return b.goalsFor - a.goalsFor;
      }
      
      return 0;
    });
    
    console.log('Pos | Equipo                    | DG  | GF');
    console.log('----|---------------------------|-----|----');
    manualOrder.forEach((team, index) => {
      const name = team.team.name.padEnd(25, ' ').substring(0, 25);
      const pos = (index + 1).toString().padStart(2, ' ');
      const gd = team.goalDifference.toString().padStart(3, ' ');
      const gf = team.goalsFor.toString().padStart(2, ' ');
      
      console.log(`${pos}  | ${name} | ${gd} | ${gf}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testTiebreakerDetailed();
