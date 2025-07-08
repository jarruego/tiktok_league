#!/usr/bin/env node

/**
 * Script para ejecutar migraciones de Drizzle en producción
 * Se ejecuta automáticamente durante el deploy en Render
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔄 Iniciando migraciones de base de datos...');

try {
  // Cambiar al directorio del servidor
  process.chdir(path.join(__dirname, '..'));
  
  console.log('📁 Directorio actual:', process.cwd());
  console.log('🗂️ Verificando archivos de migración...');
  
  // Verificar que existan migraciones
  const fs = require('fs');
  const migrationDir = path.join(process.cwd(), 'drizzle');
  
  if (!fs.existsSync(migrationDir)) {
    console.log('⚠️ No se encontró directorio de migraciones. Creando...');
    fs.mkdirSync(migrationDir, { recursive: true });
  }
  
  const migrationFiles = fs.readdirSync(migrationDir).filter(file => file.endsWith('.sql'));
  console.log(`📊 Se encontraron ${migrationFiles.length} archivos de migración`);
  
  if (migrationFiles.length > 0) {
    console.log('🔗 Ejecutando migraciones con drizzle-kit...');
    
    try {
      // Ejecutar migraciones usando drizzle-kit migrate
      execSync('npx drizzle-kit migrate', { 
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'production'
        }
      });
      
      console.log('✅ Migraciones ejecutadas exitosamente');
      
    } catch (migrationError) {
      const errorMessage = migrationError.message || migrationError.toString();
      
      // Si el error es porque las tablas ya existen, es aceptable en algunas situaciones
      if (errorMessage.includes('already exists') || errorMessage.includes('42P07')) {
        console.log('ℹ️ Algunas tablas ya existen. Esto puede ser normal si es la primera vez que se ejecuta el sistema de migraciones.');
        console.log('✅ Continuando con el inicio de la aplicación...');
      } else {
        // Otro tipo de error - propagar
        throw migrationError;
      }
    }
    
  } else {
    console.log('ℹ️ No hay migraciones pendientes para ejecutar');
  }
  
} catch (error) {
  console.error('❌ Error ejecutando migraciones:', error.message);
  
  // En producción, si las migraciones fallan, no deberíamos continuar
  if (process.env.NODE_ENV === 'production') {
    console.error('🚫 Fallo crítico en migraciones. Deteniendo deploy.');
    process.exit(1);
  } else {
    console.warn('⚠️ Error en migraciones en desarrollo, continuando...');
  }
}

console.log('🏁 Script de migraciones completado');
