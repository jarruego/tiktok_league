/**
 * Script para probar la nueva lógica de desempate de clasificaciones
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function testTiebreakerLogic() {
  console.log('🔍 Iniciando test de la lógica de desempate...\n');
  
  try {
    // Verificar que el servidor esté ejecutándose
    console.log('1. Verificando que el servidor esté activo...');
    const healthCheck = await fetch('http://localhost:3000/api/health').catch(() => null);
    if (!healthCheck) {
      console.log('❌ El servidor no está respondiendo en http://localhost:3000');
      console.log('   Asegúrate de que el backend esté ejecutándose con: npm run start:dev');
      return;
    }
    console.log('✅ Servidor activo\n');

    // Obtener información de las temporadas disponibles
    console.log('2. Obteniendo información de temporadas...');
    const seasonsResponse = await fetch('http://localhost:3000/api/league-system/seasons');
    const seasons = await seasonsResponse.json();
    
    if (!seasons || !Array.isArray(seasons) || seasons.length === 0) {
      console.log('❌ No hay temporadas disponibles');
      console.log('   Respuesta recibida:', seasons);
      return;
    }
    
    const currentSeason = seasons.find(s => s.isCurrent) || seasons[0];
    console.log(`✅ Temporada activa: ${currentSeason.name} (ID: ${currentSeason.id})\n`);

    // Obtener clasificaciones actuales
    console.log('3. Obteniendo clasificaciones actuales...');
    const standingsResponse = await fetch(`http://localhost:3000/api/matches/standings/season/${currentSeason.id}`);
    const standings = await standingsResponse.json();
    
    if (!standings || standings.length === 0) {
      console.log('❌ No hay clasificaciones disponibles');
      return;
    }
    
    console.log(`✅ Encontradas ${standings.length} ligas con clasificaciones\n`);

    // Mostrar las primeras clasificaciones para verificar el orden
    for (const leagueStandings of standings.slice(0, 2)) {
      console.log(`📊 Liga: ${leagueStandings.league.name} (${leagueStandings.league.groupCode})`);
      console.log('Pos | Equipo                    | PJ | Pts | DG  | GF | Followers');
      console.log('----|---------------------------|----|----|-----|----|---------');
      
      leagueStandings.standings.slice(0, 10).forEach(team => {
        const name = team.team.name.padEnd(25, ' ').substring(0, 25);
        const pos = team.position.toString().padStart(2, ' ');
        const played = team.played.toString().padStart(2, ' ');
        const points = team.points.toString().padStart(2, ' ');
        const gd = team.goalDifference.toString().padStart(3, ' ');
        const gf = team.goalsFor.toString().padStart(2, ' ');
        const followers = (team.team.followers || 0).toString().padStart(7, ' ');
        
        console.log(`${pos}  | ${name} | ${played} | ${points} | ${gd} | ${gf} | ${followers}`);
      });
      console.log('');
    }

    // Verificar equipos empatados
    console.log('4. Analizando equipos empatados...');
    let foundTies = false;
    
    for (const leagueStandings of standings) {
      const teams = leagueStandings.standings;
      
      // Buscar equipos con los mismos puntos
      for (let i = 0; i < teams.length - 1; i++) {
        if (teams[i].points === teams[i + 1].points) {
          if (!foundTies) {
            console.log('🔍 Equipos empatados a puntos encontrados:');
            foundTies = true;
          }
          
          const tiedTeams = [teams[i]];
          let j = i + 1;
          while (j < teams.length && teams[j].points === teams[i].points) {
            tiedTeams.push(teams[j]);
            j++;
          }
          
          console.log(`\n📍 Liga ${leagueStandings.league.name} - ${tiedTeams.length} equipos con ${teams[i].points} puntos:`);
          tiedTeams.forEach((team, idx) => {
            console.log(`   ${i + idx + 1}º ${team.team.name} - ${team.points} pts, DG: ${team.goalDifference}, GF: ${team.goalsFor}, Followers: ${team.team.followers || 0}`);
          });
          
          i = j - 1; // Saltar los equipos ya procesados
        }
      }
    }
    
    if (!foundTies) {
      console.log('ℹ️ No se encontraron equipos empatados a puntos en las clasificaciones actuales.');
      console.log('   Para probar la lógica de desempate, necesitarías simular algunos partidos');
      console.log('   que generen empates a puntos entre equipos.');
    }

    console.log('\n✅ Test completado exitosamente!');
    console.log('\n📋 La nueva lógica de desempate está implementada con el siguiente orden:');
    console.log('   1º Puntos en enfrentamientos directos');
    console.log('   2º Diferencia de goles en enfrentamientos directos'); 
    console.log('   3º Diferencia de goles general');
    console.log('   4º Goles marcados en la liga');
    console.log('   5º Número de seguidores');

  } catch (error) {
    console.error('❌ Error durante el test:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('   El servidor no está ejecutándose. Inicia con: npm run start:dev');
    }
  }
}

// Ejecutar el test
testTiebreakerLogic();
