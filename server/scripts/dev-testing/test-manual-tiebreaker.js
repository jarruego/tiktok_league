/**
 * Script para simular la lógica de desempate manualmente 
 * y comparar con lo que devuelve la API
 */

async function testManualTiebreaker() {
  console.log('🔍 Test manual de lógica de desempate...\n');
  
  try {
    // Obtener clasificaciones
    const response = await fetch(`http://localhost:3000/api/matches/standings/season/1`);
    const standings = await response.json();
    
    const divisionA = standings.find(s => s.league.groupCode === 'A');
    if (!divisionA) {
      console.log('❌ No se encontró la División A');
      return;
    }
    
    // Obtener equipos empatados a 4 puntos
    const fourPointTeams = divisionA.standings.filter(team => team.points === 4);
    
    console.log('📊 Equipos con 4 puntos (orden actual de la API):');
    fourPointTeams.forEach((team, index) => {
      console.log(`${team.position}. ${team.team.name} - Pts: ${team.points}, DG: ${team.goalDifference}, GF: ${team.goalsFor}`);
    });
    
    console.log('\n🔧 Aplicando lógica de desempate manual:');
    
    // Aplicar lógica manual
    const manualOrder = [...fourPointTeams].sort((a, b) => {
      // 1. Ya están empatados en puntos (4)
      
      // 2. Enfrentamientos directos (vamos a asumir que no hay)
      // En la realidad necesitaríamos consultar los partidos entre estos equipos
      
      // 3. Diferencia de goles general
      if (a.goalDifference !== b.goalDifference) {
        return b.goalDifference - a.goalDifference; // Mayor DG primero
      }
      
      // 4. Goles marcados
      if (a.goalsFor !== b.goalsFor) {
        return b.goalsFor - a.goalsFor; // Más goles primero
      }
      
      // 5. Alfabético por nombre si todo lo demás es igual
      return a.team.name.localeCompare(b.team.name);
    });
    
    console.log('\n📋 Orden correcto según criterios de desempate:');
    manualOrder.forEach((team, index) => {
      const newPos = index + 4; // Empiezan en posición 4 porque hay 3 equipos con 6 puntos
      const currentPos = team.position;
      const status = currentPos === newPos ? '✅' : '❌';
      console.log(`${newPos}. ${team.team.name} - DG: ${team.goalDifference}, GF: ${team.goalsFor} ${status} (actual: ${currentPos})`);
    });
    
    console.log('\n💡 Diferencias detectadas:');
    manualOrder.forEach((team, index) => {
      const expectedPos = index + 4;
      const currentPos = team.position;
      if (currentPos !== expectedPos) {
        console.log(`⚠️  ${team.team.name}: debería estar en pos ${expectedPos}, está en pos ${currentPos}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testManualTiebreaker();
