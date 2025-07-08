/**
 * Script para verificar enfrentamientos directos entre equipos empatados
 */

async function checkDirectMatches() {
  console.log('🔍 Verificando enfrentamientos directos entre equipos con 4 puntos...\n');
  
  try {
    // IDs de los equipos con 4 puntos según los datos
    // Necesitamos obtener sus IDs de la API
    const response = await fetch(`http://localhost:3000/api/matches/standings/season/1`);
    const standings = await response.json();
    
    const divisionA = standings.find(s => s.league.groupCode === 'A');
    if (!divisionA) {
      console.log('❌ No se encontró la División A');
      return;
    }
    
    const fourPointTeams = divisionA.standings.filter(team => team.points === 4);
    const teamIds = fourPointTeams.map(t => t.team.id);
    
    console.log('📋 Equipos empatados a 4 puntos:');
    fourPointTeams.forEach(team => {
      console.log(`- ${team.team.name} (ID: ${team.team.id})`);
    });
    
    console.log('\n🏆 Buscando partidos entre estos equipos...');
    
    // Buscar partidos entre estos equipos
    const matchesResponse = await fetch(`http://localhost:3000/api/matches?seasonId=1&leagueId=${divisionA.league.id}&status=finished`);
    const matchesData = await matchesResponse.json();
    
    // Filtrar partidos entre los equipos empatados
    const directMatches = matchesData.data?.filter(match => 
      teamIds.includes(match.homeTeam.id) && teamIds.includes(match.awayTeam.id)
    ) || [];
    
    if (directMatches.length === 0) {
      console.log('❗ No se encontraron enfrentamientos directos entre estos equipos');
      console.log('   Esto significa que el desempate debería basarse en:');
      console.log('   3. Diferencia de goles general');
      console.log('   4. Goles marcados');
      console.log('   5. Seguidores');
      
      console.log('\n🎯 Por tanto, el orden correcto debería ser:');
      const correctOrder = [...fourPointTeams].sort((a, b) => {
        if (a.goalDifference !== b.goalDifference) {
          return b.goalDifference - a.goalDifference;
        }
        if (a.goalsFor !== b.goalsFor) {
          return b.goalsFor - a.goalsFor;
        }
        return 0;
      });
      
      correctOrder.forEach((team, index) => {
        console.log(`   ${index + 1}. ${team.team.name} - DG: ${team.goalDifference}, GF: ${team.goalsFor}`);
      });
      
    } else {
      console.log(`✅ Encontrados ${directMatches.length} enfrentamientos directos:`);
      directMatches.forEach(match => {
        const homeTeam = fourPointTeams.find(t => t.team.id === match.homeTeam.id);
        const awayTeam = fourPointTeams.find(t => t.team.id === match.awayTeam.id);
        console.log(`   ${homeTeam.team.name} ${match.homeGoals}-${match.awayGoals} ${awayTeam.team.name}`);
      });
      
      console.log('\n📊 Esto podría afectar el desempate por enfrentamientos directos');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDirectMatches();
