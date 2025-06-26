// Ejemplo completo de importación desde Football-Data.org
// Este archivo muestra cómo usar la nueva funcionalidad

async function testFootballDataImport() {
  // 1. Datos de ejemplo de Football-Data.org (Real Madrid)
  const footballDataTeam = {
    "id": 86,
    "name": "Real Madrid CF",
    "shortName": "Real Madrid",
    "tla": "RMA",
    "crest": "https://crests.football-data.org/86.png",
    "venue": "Santiago Bernabéu",
    "founded": 1902,
    "clubColors": "White / Purple",
    "website": "http://www.realmadrid.com",
    "coach": {
      "id": 2222,
      "name": "Carlo Ancelotti",
      "nationality": "Italy"
    },
    "squad": [
      {
        "id": 3435,
        "name": "Thibaut Courtois",
        "position": "Goalkeeper",
        "dateOfBirth": "1992-05-11",
        "nationality": "Belgium",
        "shirtNumber": 1,
        "role": "PLAYER"
      },
      {
        "id": 3436,
        "name": "Vinícius Júnior",
        "position": "Left Winger",
        "dateOfBirth": "2000-07-12",
        "nationality": "Brazil",
        "shirtNumber": 7,
        "role": "PLAYER"
      },
      {
        "id": 3437,
        "name": "Karim Benzema",
        "position": "Centre-Forward",
        "dateOfBirth": "1987-12-19",
        "nationality": "France",
        "shirtNumber": 9,
        "role": "PLAYER"
      }
    ]
  };

  // 2. Importar todo de una vez
  try {
    const response = await fetch('http://localhost:3000/players/import/football-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN'
      },
      body: JSON.stringify({
        teamData: footballDataTeam,
        importDto: {
          teamId: 1, // ID de tu equipo en la BD
          footballDataTeamId: 86,
          source: 'football-data.org'
        }
      })
    });

    const result = await response.json();
    
    console.log('✅ Importación exitosa:');
    console.log(`- Mensaje: ${result.message}`);
    console.log(`- Jugadores importados: ${result.imported}`);
    console.log(`- Equipo: ${result.teamInfo.name}`);
    console.log(`- Estadio: ${result.teamInfo.venue}`);
    console.log(`- Entrenador: ${result.teamInfo.coach}`);
    
    if (result.conflicts) {
      console.log('⚠️ Conflictos encontrados:');
      result.conflicts.details.forEach(conflict => {
        console.log(`  - ${conflict.playerName} (número ${conflict.number}) conflicta con ${conflict.conflictWith}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// 3. Verificar equipos con entrenadores
async function testTeamsWithCoaches() {
  try {
    const response = await fetch('http://localhost:3000/teams');
    const teams = await response.json();
    
    console.log('📋 Equipos con entrenadores:');
    teams.forEach(team => {
      console.log(`- ${team.name} (${team.venue || 'Sin estadio'})`);
      if (team.coach) {
        console.log(`  Entrenador: ${team.coach.name} (${team.coach.nationality})`);
      }
      console.log(`  TikTok: ${team.followers} seguidores`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// 4. Verificar jugadores de un equipo
async function testPlayersFromTeam(teamId) {
  try {
    const response = await fetch(`http://localhost:3000/players/team/${teamId}`);
    const players = await response.json();
    
    console.log(`⚽ Jugadores del equipo ${teamId}:`);
    players.forEach(player => {
      console.log(`- ${player.name} (#${player.shirtNumber || 'S/N'}) - ${player.position}`);
      console.log(`  ${player.nationality} - ${player.role}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar pruebas
console.log('🚀 Iniciando pruebas de Football-Data.org...');

// Descomenta para probar:
// testFootballDataImport();
// testTeamsWithCoaches();
// testPlayersFromTeam(1);
