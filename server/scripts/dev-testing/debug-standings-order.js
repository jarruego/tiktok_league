/**
 * Script para verificar directamente la diferencia entre la API y la lógica esperada
 */

async function debugStandingsOrder() {
  console.log('🔍 Debug del orden de clasificaciones...\n');
  
  try {
    // Obtener clasificaciones de la API
    console.log('1. Obteniendo clasificaciones de la API...');
    const standingsResponse = await fetch(`http://localhost:3000/api/matches/standings/season/1`);
    const standings = await standingsResponse.json();
    
    const divisionAStandings = standings.find(s => s.league.groupCode === 'A');
    if (!divisionAStandings) {
      console.log('❌ No se encontró la División A');
      return;
    }
    
    console.log('✅ Clasificaciones obtenidas de la API\n');
    
    // Mostrar TODOS los equipos ordenados según la API
    console.log('📊 ORDEN ACTUAL según la API:');
    console.log('Pos | Equipo                    | Pts | DG  | GF | GA');
    console.log('----|---------------------------|-----|-----|----|----|');
    
    divisionAStandings.standings.forEach(team => {
      const name = team.team.name.padEnd(25, ' ').substring(0, 25);
      const pos = team.position.toString().padStart(2, ' ');
      const points = team.points.toString().padStart(2, ' ');
      const gd = team.goalDifference.toString().padStart(3, ' ');
      const gf = team.goalsFor.toString().padStart(2, ' ');
      const ga = team.goalsAgainst.toString().padStart(2, ' ');
      
      console.log(`${pos}  | ${name} | ${points} | ${gd} | ${gf} | ${ga}`);
    });
    
    console.log('\n🔄 ORDEN ESPERADO aplicando lógica manualmente:');
    console.log('Pos | Equipo                    | Pts | DG  | GF | GA');
    console.log('----|---------------------------|-----|-----|----|----|');
    
    // Ordenar manualmente aplicando la lógica correcta
    const correctOrder = [...divisionAStandings.standings].sort((a, b) => {
      // 1. Por puntos (descendente)
      if (b.points !== a.points) return b.points - a.points;
      
      // 2. Por diferencia de goles general (descendente)
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      
      // 3. Por goles marcados (descendente)
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      
      // 4. Por nombre (alfabético como último recurso)
      return a.team.name.localeCompare(b.team.name);
    });
    
    correctOrder.forEach((team, index) => {
      const name = team.team.name.padEnd(25, ' ').substring(0, 25);
      const pos = (index + 1).toString().padStart(2, ' ');
      const points = team.points.toString().padStart(2, ' ');
      const gd = team.goalDifference.toString().padStart(3, ' ');
      const gf = team.goalsFor.toString().padStart(2, ' ');
      const ga = team.goalsAgainst.toString().padStart(2, ' ');
      
      // Marcar si la posición cambió
      const currentPos = team.position;
      const expectedPos = index + 1;
      const marker = currentPos !== expectedPos ? ' ⚠️' : '';
      
      console.log(`${pos}  | ${name} | ${points} | ${gd} | ${gf} | ${ga}${marker}`);
    });
    
    // Identificar diferencias
    console.log('\n🔍 DIFERENCIAS DETECTADAS:');
    let foundDifferences = false;
    
    correctOrder.forEach((team, index) => {
      const expectedPos = index + 1;
      const currentPos = team.position;
      
      if (currentPos !== expectedPos) {
        foundDifferences = true;
        console.log(`⚠️  ${team.team.name}: Posición actual ${currentPos}, debería ser ${expectedPos}`);
      }
    });
    
    if (!foundDifferences) {
      console.log('✅ No hay diferencias - El orden es correcto');
    }
    
    // Verificar equipos empatados específicos
    console.log('\n🎯 ANÁLISIS DE EMPATES:');
    const groupedByPoints = {};
    divisionAStandings.standings.forEach(team => {
      const points = team.points;
      if (!groupedByPoints[points]) groupedByPoints[points] = [];
      groupedByPoints[points].push(team);
    });
    
    Object.keys(groupedByPoints).sort((a, b) => b - a).forEach(points => {
      const teams = groupedByPoints[points];
      if (teams.length > 1) {
        console.log(`\n📍 ${teams.length} equipos empatados a ${points} puntos:`);
        teams.forEach(team => {
          console.log(`   Pos ${team.position}: ${team.team.name} - DG: ${team.goalDifference}, GF: ${team.goalsFor}`);
        });
        
        // Verificar si están ordenados correctamente dentro del empate
        const sortedGroup = [...teams].sort((a, b) => {
          if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
          if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
          return a.team.name.localeCompare(b.team.name);
        });
        
        let groupCorrect = true;
        teams.forEach((team, index) => {
          if (team.team.id !== sortedGroup[index].team.id) {
            groupCorrect = false;
          }
        });
        
        if (!groupCorrect) {
          console.log('   ❌ ORDEN INCORRECTO en este grupo');
          console.log('   ✅ Orden correcto sería:');
          sortedGroup.forEach((team, index) => {
            console.log(`      ${index + 1}. ${team.team.name} - DG: ${team.goalDifference}, GF: ${team.goalsFor}`);
          });
        } else {
          console.log('   ✅ Orden correcto en este grupo');
        }
      }
    });

  } catch (error) {
    console.error('❌ Error durante el debug:', error.message);
  }
}

// Ejecutar el debug
debugStandingsOrder();
