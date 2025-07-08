#!/usr/bin/env node

/**
 * Script de diagnóstico para verificar que Puppeteer y Chrome estén funcionando correctamente
 * Útil para debuggear problemas en entornos de producción como Render
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function diagnosticPuppeteer() {
  console.log('🔍 Iniciando diagnóstico de Puppeteer...\n');

  // Información del entorno
  console.log('📋 Información del entorno:');
  console.log(`- Node.js: ${process.version}`);
  console.log(`- Platform: ${process.platform}`);
  console.log(`- Architecture: ${process.arch}`);
  console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`- RENDER: ${process.env.RENDER || 'false'}`);
  console.log(`- PUPPETEER_CACHE_DIR: ${process.env.PUPPETEER_CACHE_DIR || 'no configurado'}`);
  console.log('');

  // Verificar archivos de Puppeteer
  console.log('📁 Verificando cache de Puppeteer...');
  const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(__dirname, '.cache', 'puppeteer');
  console.log(`- Cache directory: ${cacheDir}`);
  
  if (fs.existsSync(cacheDir)) {
    console.log('✅ Directory de cache existe');
    const contents = fs.readdirSync(cacheDir, { recursive: true });
    console.log(`- Archivos en cache: ${contents.length}`);
    if (contents.length > 0) {
      console.log(`- Algunos archivos: ${contents.slice(0, 5).join(', ')}${contents.length > 5 ? '...' : ''}`);
    }
  } else {
    console.log('❌ Directory de cache no existe');
  }
  console.log('');

  // Configuración de Puppeteer
  const puppeteerConfig = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  };

  console.log('🚀 Configuración de Puppeteer:');
  console.log(`- Headless: ${puppeteerConfig.headless}`);
  console.log(`- Args: ${puppeteerConfig.args.length} argumentos`);
  console.log('');

  // Intentar lanzar Puppeteer
  let browser;
  try {
    console.log('🔥 Intentando lanzar navegador...');
    browser = await puppeteer.launch(puppeteerConfig);
    console.log('✅ Navegador lanzado exitosamente!');

    // Información del navegador
    const version = await browser.version();
    console.log(`- Versión del navegador: ${version}`);

    // Intentar crear una página
    console.log('📄 Intentando crear página...');
    const page = await browser.newPage();
    console.log('✅ Página creada exitosamente!');

    // Intentar navegar a una página simple
    console.log('🌐 Intentando navegar a Google...');
    await page.goto('https://www.google.com', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Navegación exitosa!');

    // Obtener título de la página
    const title = await page.title();
    console.log(`- Título de la página: ${title}`);

    await page.close();
    await browser.close();

    console.log('\n🎉 ¡Diagnóstico completado! Puppeteer está funcionando correctamente.');
    
  } catch (error) {
    console.log('\n❌ Error durante el diagnóstico:');
    console.error(error.message);
    
    if (error.message.includes('Could not find Chrome')) {
      console.log('\n💡 Sugerencias para solucionar el problema:');
      console.log('1. Ejecutar: npx puppeteer browsers install chrome');
      console.log('2. Verificar que NODE_ENV esté configurado correctamente');
      console.log('3. Verificar permisos de escritura en el directorio de cache');
      console.log('4. En Render, asegurar que el buildCommand incluye la instalación de Chrome');
    }
    
    if (browser) {
      await browser.close();
    }
    
    process.exit(1);
  }
}

// Ejecutar el diagnóstico
diagnosticPuppeteer().catch(console.error);
