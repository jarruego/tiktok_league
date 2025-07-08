import { Controller, Post, UseGuards, Get } from '@nestjs/common';
import { MigrationService } from './migration.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * Controlador para gestión de migraciones de base de datos
 * Solo accesible para usuarios autenticados
 */
@Controller('migrations')
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  /**
   * Endpoint de emergencia para ejecutar migraciones manualmente
   * Útil si las migraciones automáticas fallan
   */
  @UseGuards(JwtAuthGuard)
  @Post('run')
  async runMigrations() {
    return this.migrationService.runMigrationsManually();
  }

  /**
   * Endpoint para verificar el estado de las migraciones
   */
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getMigrationStatus() {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const migrationDir = path.join(process.cwd(), 'drizzle');
      
      if (!fs.existsSync(migrationDir)) {
        return {
          migrationDir: migrationDir,
          exists: false,
          files: [],
          count: 0
        };
      }
      
      const migrationFiles = fs.readdirSync(migrationDir).filter(file => file.endsWith('.sql'));
      
      return {
        migrationDir: migrationDir,
        exists: true,
        files: migrationFiles,
        count: migrationFiles.length,
        latest: migrationFiles.length > 0 ? migrationFiles[migrationFiles.length - 1] : null,
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}
