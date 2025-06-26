// Ejemplo completo de importación desde Football-Data.org
// Con tu token de API real: 48f59503f54c4917b158b67adb46ae44

async function testFootballDataAPI() {
  // 1. Probar conexión directa a Football-Data.org
  console.log('🧪 Probando conexión directa a Football-Data.org...');
  
  try {
    const response = await fetch('https://api.football-data.org/v4/teams/86', {
      headers: {
        'X-Auth-Token': '48f59503f54c4917b158b67adb46ae44'
      }
    });

    if (response.ok) {
      const teamData = await response.json();
      console.log('✅ Conexión exitosa!');
      console.log(`📋 Equipo: ${teamData.name}`);
      console.log(`🏟️ Estadio: ${teamData.venue}`);
      console.log(`👥 Jugadores en plantilla: ${teamData.squad.length}`);
    } else {
      console.log('❌ Error en la API:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
  }
}

async function testLocalAPIEndpoints() {
  // 2. Probar endpoints locales con Football-Data integrado
  console.log('\n🧪 Probando endpoints locales...');
  
  try {
    // Verificar configuración
    const infoResponse = await fetch('http://localhost:3000/football-data/info');
    const apiInfo = await infoResponse.json();
    console.log('📊 Info de API:', apiInfo);

    // Importación simplificada (nuevo endpoint)
    const importResponse = await fetch('http://localhost:3000/players/import/football-data-by-id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN'
      },
      body: JSON.stringify({
        teamId: 1, // Tu ID interno del equipo
        footballDataTeamId: 86 // Real Madrid en Football-Data.org
      })
    });

    if (importResponse.ok) {
      const result = await importResponse.json();
      console.log('✅ Importación exitosa:');
      console.log(`- ${result.message}`);
      console.log(`- Jugadores importados: ${result.imported}`);
      console.log(`- Equipo actualizado: ${result.teamInfo.name}`);
    }

  } catch (error) {
    console.error('❌ Error en endpoints locales:', error.message);
  }
}

// Equipos disponibles para probar (free tier)
const availableTeams = {
  // Premier League
  'Manchester United': 66,
  'Arsenal': 57,
  'Chelsea': 61,
  'Liverpool': 64,
  'Manchester City': 65,
  'Tottenham': 73,
  
  // La Liga  
  'Real Madrid': 86,
  'Barcelona': 81,
  'Atletico Madrid': 78,
  'Valencia': 95,
  
  // Bundesliga
  'Bayern Munich': 5,
  'Borussia Dortmund': 4,
  
  // Serie A
  'Juventus': 109,
  'AC Milan': 98,
  'Inter Milan': 108,
  
  // Ligue 1
  'PSG': 524
};

console.log('🚀 Equipos disponibles para importar:');
Object.entries(availableTeams).forEach(([name, id]) => {
  console.log(`- ${name}: ${id}`);
});

console.log('\n📝 Para importar un equipo específico:');
console.log(`fetch('/players/import/football-data-by-id', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer TOKEN' },
  body: JSON.stringify({ teamId: TU_EQUIPO_ID, footballDataTeamId: FOOTBALL_DATA_ID })
});`);

// Ejecutar pruebas
// Descomenta para probar:
// testFootballDataAPI();
// testLocalAPIEndpoints();
