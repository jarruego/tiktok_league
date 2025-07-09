# Scripts para Foodball

Este directorio contiene scripts utilizados para el mantenimiento, desarrollo y depuración del proyecto Foodball.

## Estructura de carpetas

- **/prod**: Scripts utilizados en el entorno de producción
  - `migrate-prod.js` - Script de migración de base de datos para producción

- **/dev**: Scripts de desarrollo regular
  - `test-simulation.js` - Demo del sistema de simulación
  - `check-divisions.js/ts` - Verificación de divisiones en la base de datos
  - `update-division1.js` - Actualización de la división 1

- **/debug**: Scripts de diagnóstico y depuración
  - `puppeteer-diagnostic.js` - Diagnóstico del entorno de Puppeteer
  - `puppeteer-compatibility-check.js` - Verificación de compatibilidad de Puppeteer
  - `football-data-rate-limit-test.js` - Prueba de límites de tasa para la API

- **/archive**: Scripts antiguos o utilizados una sola vez
  - Contiene scripts de prueba para la lógica de desempate y otros diagnósticos específicos

- **/local**: Scripts específicos del entorno local
  - Esta carpeta está ignorada por git y es ideal para scripts personalizados

## Uso

La mayoría de los scripts tienen comandos NPM asociados en `package.json`:

```bash
# Scripts de producción
npm run db:migrate:prod

# Scripts de diagnóstico
npm run puppeteer-diagnostic
npm run puppeteer-compatibility
npm run test-rate-limit

# Scripts de desarrollo
npm run demo:simulation

# Scripts archivados (para referencia)
npm run dev:test-tiebreaker
npm run dev:check-matches
npm run dev:debug-standings
```

## Directrices para nuevos scripts

Al crear nuevos scripts:

1. Colócalos en la carpeta apropiada según su propósito
2. Documenta claramente qué hace el script al inicio del archivo
3. Agrega un comando en package.json si el script es de uso frecuente
4. Usa la extensión `.ts` para scripts TypeScript y `.js` para JavaScript
