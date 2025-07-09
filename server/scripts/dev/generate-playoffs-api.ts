import "dotenv/config";

async function generatePlayoffsForReadyDivisions() {
  console.log("=== GENERANDO PLAYOFFS PARA DIVISIONES LISTAS ===");
  
  try {
    // Verificar si el servidor está corriendo
    const response = await fetch('http://localhost:3001/api/health', {
      method: 'GET',
    });
    
    if (!response.ok) {
      console.log("❌ El servidor no está corriendo en el puerto 3001");
      console.log("💡 Por favor, ejecuta 'npm run start:dev' en otra terminal primero");
      return;
    }
    
    console.log("✅ Servidor encontrado, procediendo...");
    
    // Llamar al endpoint de generación de playoffs
    console.log("\n🎯 Llamando a /season-transition/organize-playoffs...");
    
    const playoffResponse = await fetch('http://localhost:3001/season-transition/organize-playoffs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!playoffResponse.ok) {
      const errorText = await playoffResponse.text();
      console.error(`❌ Error en la respuesta: ${playoffResponse.status} - ${errorText}`);
      return;
    }
    
    const result = await playoffResponse.json();
    console.log("🎉 Respuesta exitosa:");
    console.log(JSON.stringify(result, null, 2));
    
    console.log("\n✅ Generación de playoffs completada");
    
  } catch (error) {
    console.error("❌ Error:", error);
    console.log("\n💡 Asegúrate de que el servidor está corriendo con 'npm run start:dev'");
  }
}

generatePlayoffsForReadyDivisions();
