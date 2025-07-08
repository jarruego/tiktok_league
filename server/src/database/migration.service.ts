import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Servicio para gestionar migraciones automáticas en producción
 * Se ejecuta automáticamente al inicializar el módulo
 */
@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  async onModuleInit() {
    // Solo ejecutar migraciones automáticas en producción
    if (process.env.NODE_ENV === 'production' && process.env.AUTO_MIGRATE === 'true') {
      await this.runMigrations();
    } else {
      this.logger.log('Migraciones automáticas deshabilitadas (no es producción o AUTO_MIGRATE=false)');
    }
  }

  /**
   * Ejecuta las migraciones pendientes de la base de datos
   */
  async runMigrations(): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('🔄 Iniciando migraciones automáticas de base de datos...');

      // Verificar que existe el directorio de migraciones
      const migrationDir = join(process.cwd(), 'drizzle');
      
      if (!existsSync(migrationDir)) {
        this.logger.warn('⚠️ Directorio de migraciones no encontrado');
        return { success: false, message: 'Directorio de migraciones no encontrado' };
      }

      // Contar archivos de migración
      const migrationFiles = readdirSync(migrationDir).filter(file => file.endsWith('.sql'));
      this.logger.log(`📊 Se encontraron ${migrationFiles.length} archivos de migración`);

      if (migrationFiles.length === 0) {
        this.logger.log('ℹ️ No hay migraciones para ejecutar');
        return { success: true, message: 'No hay migraciones pendientes' };
      }

      // Ejecutar migraciones
      this.logger.log('🗃️ Ejecutando migraciones...');
      
      execSync('npx drizzle-kit migrate', { 
        stdio: 'pipe',
        encoding: 'utf-8',
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || 'production'
        }
      });

      this.logger.log('✅ Migraciones ejecutadas exitosamente');
      return { success: true, message: `${migrationFiles.length} migraciones ejecutadas correctamente` };

    } catch (error) {
      this.logger.error('❌ Error ejecutando migraciones:', error.message);
      
      // En producción, las migraciones fallidas son críticas
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('🚫 Fallo crítico en migraciones');
        throw new Error(`Migration failed: ${error.message}`);
      }
      
      return { success: false, message: error.message };
    }
  }

  /**
   * Ejecuta migraciones manualmente (endpoint de emergencia)
   */
  async runMigrationsManually(): Promise<{ success: boolean; message: string }> {
    this.logger.log('🔧 Ejecutando migraciones manualmente...');
    return await this.runMigrations();
  }
}
