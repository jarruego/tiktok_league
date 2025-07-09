import axios from 'axios';

async function analyzeCurrentPlayoffState() {
  console.log('🔍 Analizando estado actual de playoffs...\n');
  
  const API_BASE_URL = 'http://localhost:3000/api';
  
  try {
    // 1. Obtener partidos de playoff
    console.log('📊 Obteniendo partidos de playoff...');
    const playoffResponse = await axios.get(`${API_BASE_URL}/matches?isPlayoff=true&seasonId=1`);
    const playoffMatches = playoffResponse.data.matches;
    
    console.log(`Total partidos de playoff encontrados: ${playoffMatches.length}\n`);

    if (playoffMatches.length > 0) {
      console.log('🏆 PARTIDOS DE PLAYOFF ACTUALES:');
      
      playoffMatches.forEach((match: any) => {
        console.log(`Match ${match.id}: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
        console.log(`  Ronda: ${match.playoffRound || 'N/A'} | Jornada: ${match.matchday}`);
        console.log(`  Resultado: ${match.homeGoals ?? 'N/A'} - ${match.awayGoals ?? 'N/A'} | Estado: ${match.status}`);
        console.log(`  Fecha: ${match.scheduledDate} | Liga: ${match.league.name}`);
        
        // Verificar si hay empate
        if (match.homeGoals !== null && match.awayGoals !== null && match.homeGoals === match.awayGoals) {
          console.log(`  ⚠️  EMPATE DETECTADO! Los playoffs no pueden terminar en empate`);
        }
        console.log('');
      });
    }

    // 2. Obtener clasificaciones de temporada para analizar quien debería estar en playoffs
    console.log('📋 Obteniendo clasificaciones de División 2...');
    const standingsResponse = await axios.get(`${API_BASE_URL}/standings/season/1`);
    const seasonStandings = standingsResponse.data;
    
    // Buscar liga de División 2
    const division2Standings = seasonStandings.find((leagueStanding: any) => 
      leagueStanding.division.level === 2
    );
    
    if (division2Standings) {
      console.log(`--- LIGA: ${division2Standings.league.name} (División ${division2Standings.division.level}) ---`);
      
      division2Standings.standings.forEach((team: any, index: number) => {
        let status = '';
        if (team.position <= 2) {
          status = '⬆️ ASCIENDE DIRECTO';
        } else if (team.position >= 3 && team.position <= 6) {
          status = '🏆 PLAYOFF';
        }
        
        console.log(`${team.position}. ${team.team.name} - ${team.points} pts (${team.played}j, GD: ${team.goalDifference}) ${status}`);
      });
      
      console.log('\n🎯 EMPAREJAMIENTOS CORRECTOS DEBERÍAN SER:');
      const playoffTeams = division2Standings.standings.filter((team: any) => 
        team.position >= 3 && team.position <= 6
      );
      
      if (playoffTeams.length === 4) {
        console.log(`Semifinal 1: ${playoffTeams[0].team.name} (3º) vs ${playoffTeams[3].team.name} (6º)`);
        console.log(`Semifinal 2: ${playoffTeams[1].team.name} (4º) vs ${playoffTeams[2].team.name} (5º)`);
      }
    }

  } catch (error) {
    console.error('Error al analizar playoffs:', error.message);
  }
}

analyzeCurrentPlayoffState().catch(console.error);

analyzeCurrentPlayoffState().catch(console.error);
