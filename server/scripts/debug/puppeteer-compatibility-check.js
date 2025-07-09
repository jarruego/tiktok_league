#!/usr/bin/env node

/**
 * Script para verificar compatibilidad de funciones de Puppeteer
 * Verifica que todas las funciones usadas en el código sean compatibles con la versión instalada
 */

const puppeteer = require('puppeteer');

async function checkPuppeteerCompatibility() {
  console.log('🔍 Verificando compatibilidad de Puppeteer...\n');

  let browser;
  try {
    // Información de versión
    console.log('📋 Información de Puppeteer:');
    console.log(`- Versión instalada: ${require('puppeteer/package.json').version}`);
    
    // Lanzar navegador
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    console.log('✅ Navegador lanzado exitosamente');

    // Verificar funciones críticas
    console.log('\n🔧 Verificando funciones disponibles:');
    
    // Función 1: setUserAgent
    try {
      await page.setUserAgent('test');
      console.log('✅ setUserAgent - Disponible');
    } catch (error) {
      console.log('❌ setUserAgent - Error:', error.message);
    }

    // Función 2: setExtraHTTPHeaders
    try {
      await page.setExtraHTTPHeaders({ 'Accept': 'text/html' });
      console.log('✅ setExtraHTTPHeaders - Disponible');
    } catch (error) {
      console.log('❌ setExtraHTTPHeaders - Error:', error.message);
    }

    // Función 3: setViewport
    try {
      await page.setViewport({ width: 375, height: 812 });
      console.log('✅ setViewport - Disponible');
    } catch (error) {
      console.log('❌ setViewport - Error:', error.message);
    }

    // Función 4: evaluateOnNewDocument
    try {
      await page.evaluateOnNewDocument(() => {
        console.log('test');
      });
      console.log('✅ evaluateOnNewDocument - Disponible');
    } catch (error) {
      console.log('❌ evaluateOnNewDocument - Error:', error.message);
    }

    // Función 5: goto
    try {
      await page.goto('https://www.google.com', { 
        waitUntil: 'domcontentloaded', 
        timeout: 10000 
      });
      console.log('✅ goto con domcontentloaded - Disponible');
    } catch (error) {
      console.log('❌ goto - Error:', error.message);
    }

    // Función 6: waitForSelector
    try {
      await page.waitForSelector('body', { timeout: 5000 });
      console.log('✅ waitForSelector - Disponible');
    } catch (error) {
      console.log('❌ waitForSelector - Error:', error.message);
    }

    // Función 7: $eval
    try {
      const title = await page.$eval('title', el => el.textContent);
      console.log('✅ $eval - Disponible');
    } catch (error) {
      console.log('❌ $eval - Error:', error.message);
    }

    // Función 8: evaluate
    try {
      const result = await page.evaluate(() => document.title);
      console.log('✅ evaluate - Disponible');
    } catch (error) {
      console.log('❌ evaluate - Error:', error.message);
    }

    // Función DEPRECADA: waitForTimeout (no debería existir)
    if (typeof page.waitForTimeout === 'function') {
      console.log('⚠️ waitForTimeout - Disponible (pero deprecada)');
    } else {
      console.log('✅ waitForTimeout - Correctamente NO disponible (como esperado)');
    }

    await browser.close();
    
    console.log('\n🎉 Verificación de compatibilidad completada!');
    console.log('💡 Si todas las funciones están disponibles, el scraping debería funcionar correctamente.');

  } catch (error) {
    console.log('\n❌ Error durante la verificación:');
    console.error(error.message);
    
    if (browser) {
      await browser.close();
    }
    
    process.exit(1);
  }
}

// Ejecutar verificación
checkPuppeteerCompatibility().catch(console.error);
