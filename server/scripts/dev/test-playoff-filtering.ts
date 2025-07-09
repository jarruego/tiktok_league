import "dotenv/config";

async function testPlayoffFiltering() {
  console.log("=== PRUEBA DE FILTRADO DE PARTIDOS DE PLAYOFF ===");
  
  // Esperar a que el servidor esté listo
  console.log("⏳ Esperando que el servidor esté listo...");
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  try {
    // 1. Probar endpoint sin filtros
    console.log("\n1. 🔍 Probando endpoint sin filtros...");
    const responseAll = await fetch('http://localhost:3000/matches?seasonId=1&limit=5');
    
    if (responseAll.ok) {
      const dataAll = await responseAll.json();
      console.log(`✅ Sin filtros: ${dataAll.matches.length} partidos encontrados`);
      
      if (dataAll.matches.length > 0) {
        const firstMatch = dataAll.matches[0];
        console.log(`   📋 Primer partido: isPlayoff=${firstMatch.isPlayoff}, round=${firstMatch.playoffRound || 'N/A'}`);
      }
    } else {
      console.log(`❌ Error sin filtros: ${responseAll.status}`);
    }
    
    // 2. Probar filtro de partidos regulares
    console.log("\n2. ⚽ Probando filtro de partidos regulares...");
    const responseRegular = await fetch('http://localhost:3000/matches?seasonId=1&isPlayoff=false&limit=5');
    
    if (responseRegular.ok) {
      const dataRegular = await responseRegular.json();
      console.log(`✅ Partidos regulares: ${dataRegular.matches.length} encontrados`);
      
      if (dataRegular.matches.length > 0) {
        const allRegular = dataRegular.matches.every(m => m.isPlayoff === false);
        console.log(`   📊 Todos son regulares: ${allRegular}`);
      }
    } else {
      const errorText = await responseRegular.text();
      console.log(`❌ Error partidos regulares: ${responseRegular.status} - ${errorText}`);
    }
    
    // 3. Probar filtro de playoffs
    console.log("\n3. 🏆 Probando filtro de playoffs...");
    const responsePlayoffs = await fetch('http://localhost:3000/matches?seasonId=1&isPlayoff=true');
    
    if (responsePlayoffs.ok) {
      const dataPlayoffs = await responsePlayoffs.json();
      console.log(`✅ Partidos de playoff: ${dataPlayoffs.matches.length} encontrados`);
      
      if (dataPlayoffs.matches.length > 0) {
        const allPlayoffs = dataPlayoffs.matches.every(m => m.isPlayoff === true);
        console.log(`   📊 Todos son playoffs: ${allPlayoffs}`);
        
        // Mostrar detalles de los playoffs
        dataPlayoffs.matches.forEach((match, i) => {
          console.log(`   🏟️ Playoff ${i+1}: ${match.homeTeam.name} vs ${match.awayTeam.name} (${match.playoffRound || 'Sin ronda'})`);
        });
      }
    } else {
      const errorText = await responsePlayoffs.text();
      console.log(`❌ Error playoffs: ${responsePlayoffs.status} - ${errorText}`);
    }
    
    // 4. Probar filtro por ronda específica
    console.log("\n4. 🎯 Probando filtro por ronda 'Semifinal'...");
    const responseSemifinal = await fetch('http://localhost:3000/matches?seasonId=1&playoffRound=Semifinal');
    
    if (responseSemifinal.ok) {
      const dataSemifinal = await responseSemifinal.json();
      console.log(`✅ Semifinales: ${dataSemifinal.matches.length} encontradas`);
      
      if (dataSemifinal.matches.length > 0) {
        dataSemifinal.matches.forEach((match, i) => {
          console.log(`   🏆 Semifinal ${i+1}: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
        });
      }
    } else {
      const errorText = await responseSemifinal.text();
      console.log(`❌ Error semifinales: ${responseSemifinal.status} - ${errorText}`);
    }
    
    console.log("\n🎉 Prueba de filtrado completada!");
    
  } catch (error) {
    console.error("❌ Error durante la prueba:", error);
  }
}

testPlayoffFiltering();
