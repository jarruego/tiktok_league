#!/usr/bin/env node

/**
 * Script para verificar y simular el comportamiento de rate limiting
 * con la API de Football-Data.org
 */

const https = require('https');

// Simular la configuración del servicio
const API_KEY = process.env.FOOTBALL_DATA_API_KEY || '';
const API_URL = 'https://api.football-data.org/v4';

function makeRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.football-data.org',
      port: 443,
      path: `/v4${endpoint}`,
      method: 'GET',
      headers: {
        'X-Auth-Token': API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'Foodball-App/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
          endpoint: endpoint
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function testRateLimit() {
  console.log('🔍 Probando límites de rate limiting de Football-Data.org API...\n');

  if (!API_KEY) {
    console.log('❌ FOOTBALL_DATA_API_KEY no está configurada');
    console.log('💡 Configura la variable de entorno antes de ejecutar este script');
    process.exit(1);
  }

  console.log('📋 Configuración:');
  console.log(`- API Key: ${API_KEY.substring(0, 8)}...`);
  console.log(`- Base URL: ${API_URL}`);
  console.log('');

  // Test básico de conectividad
  console.log('🌐 Test 1: Conectividad básica');
  try {
    const result = await makeRequest('/competitions');
    console.log(`✅ Status: ${result.status}`);
    console.log(`📊 Headers relevantes:`);
    console.log(`- X-API-Version: ${result.headers['x-api-version'] || 'No especificada'}`);
    console.log(`- X-Requests-Available-Minute: ${result.headers['x-requests-available-minute'] || 'No especificada'}`);
    console.log(`- X-Requests-Available-Day: ${result.headers['x-requests-available-day'] || 'No especificada'}`);
    console.log('');
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    if (error.message.includes('429')) {
      console.log('🚫 Ya estás en rate limit. Espera antes de continuar.');
      process.exit(1);
    }
  }

  // Test de múltiples requests rápidos
  console.log('⚡ Test 2: Múltiples requests rápidos (para detectar límites)');
  const endpoints = [
    '/competitions/2021', // Premier League
    '/competitions/2014', // La Liga
    '/competitions/2002', // Bundesliga
  ];

  for (let i = 0; i < endpoints.length; i++) {
    try {
      console.log(`📡 Request ${i + 1}: ${endpoints[i]}`);
      const start = Date.now();
      const result = await makeRequest(endpoints[i]);
      const duration = Date.now() - start;
      
      console.log(`✅ Status: ${result.status} (${duration}ms)`);
      
      if (result.status === 429) {
        console.log('🚫 Rate limit alcanzado en request', i + 1);
        console.log('📊 Headers de rate limit:');
        console.log(result.headers);
        break;
      }
      
      // Esperar un poco entre requests
      if (i < endpoints.length - 1) {
        console.log('⏱️ Esperando 2 segundos...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.log(`❌ Error en request ${i + 1}: ${error.message}`);
      if (error.message.includes('429')) {
        console.log('🚫 Rate limit detectado');
        break;
      }
    }
  }

  console.log('\n📋 Recomendaciones basadas en las pruebas:');
  console.log('- ✅ Usar intervalos de 12-15 segundos entre requests');
  console.log('- ✅ Implementar retry con backoff exponencial para errores 429');
  console.log('- ✅ Monitorear headers de rate limiting si están disponibles');
  console.log('- ✅ Usar /football-data/cache/safe-single para cachear gradualmente');
  console.log('- ❌ Evitar /football-data/cache/all-competitions en producción');
}

// Ejecutar el test
testRateLimit().catch(console.error);
