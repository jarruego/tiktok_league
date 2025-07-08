const { join } = require('path');

/**
 * Configuración de Puppeteer optimizada para Render y otros entornos de producción
 * @see https://pptr.dev/guides/configuration
 */
module.exports = {
  // Descargar en una carpeta específica para persistencia
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
  
  // Configuración específica para Chrome
  chrome: {
    // Usar la última versión estable
    channel: 'chrome',
    // Configuración para contenedores Linux
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
  }
};
