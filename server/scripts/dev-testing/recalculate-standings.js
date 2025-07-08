/**
 * Script para forzar recalculación de clasificaciones
 */

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');

async function recalculateStandings() {
  console.log('🔄 Iniciando recalculación de clasificaciones...\n');
  
  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const standingsService = app.get('StandingsService');
    
    console.log('🏁 Recalculando clasificaciones para temporada 1...');
    await standingsService.recalculateStandingsForSeason(1);
    
    console.log('✅ Recalculación completada!');
    
    await app.close();
  } catch (error) {
    console.error('❌ Error durante la recalculación:', error.message);
  }
}

recalculateStandings();
