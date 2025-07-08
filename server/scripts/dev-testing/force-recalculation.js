/**
 * Script para forzar recalculación directa vía HTTP
 */

async function forceRecalculation() {
  console.log('🔄 Forzando recalculación de clasificaciones...\n');
  
  try {
    // Simular un partido para forzar recalculación
    console.log('1. Simulando un partido para activar recalculación...');
    
    // Obtener un partido existente para simular
    const matchesResponse = await fetch('http://localhost:3000/api/matches?seasonId=1&status=scheduled&limit=1');
    const matchesData = await matchesResponse.json();
    
    if (!matchesData.data || matchesData.data.length === 0) {
      console.log('❌ No hay partidos programados para simular');
      return;
    }
    
    const match = matchesData.data[0];
    console.log(`   Simulando: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
    
    // Simular el partido con resultado 0-0 para no afectar mucho las estadísticas
    const simulateResponse = await fetch(`http://localhost:3000/api/matches/${match.id}/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        homeGoals: 0,
        awayGoals: 0
      })
    });
    
    if (simulateResponse.ok) {
      console.log('✅ Partido simulado, esto debería recalcular las clasificaciones');
      
      // Esperar un momento para que se procesen los cambios
      console.log('\n2. Esperando que se procesen los cambios...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verificar el nuevo orden
      console.log('\n3. Verificando nuevo orden...');
      const newStandingsResponse = await fetch('http://localhost:3000/api/matches/standings/season/1');
      const newStandings = await newStandingsResponse.json();
      
      const divisionA = newStandings.find(s => s.league.groupCode === 'A');
      const fourPointTeams = divisionA.standings.filter(team => team.points === 4);
      
      console.log('\n📊 Nuevo orden de equipos con 4 puntos:');
      fourPointTeams.forEach(team => {
        console.log(`${team.position}. ${team.team.name} - DG: ${team.goalDifference}, GF: ${team.goalsFor}`);
      });
      
    } else {
      console.log('❌ Error simulando partido:', await simulateResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

forceRecalculation();
