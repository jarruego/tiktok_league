import { Controller, Get, Param, Res, Query, BadRequestException, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Endpoint temporal para descargar archivos de debug generados por Puppeteer
 * Ejemplo: GET /tiktok-scraper/debug/debug-<tiktokId>.html
 * Seguridad: Solo permite archivos que empiecen por debug- y terminen en .html o .png
 * Se recomienda proteger este endpoint en producción (por variable de entorno o auth)
 */
@Controller('tiktok-scraper/debug')
export class TiktokScraperDebugController {
  @Get(':filename')
  async getDebugFile(
    @Param('filename') filename: string,
    @Res() res: Response,
    @Query('token') token?: string // (opcional) para protección básica
  ) {
    // Permitir solo archivos debug-*.html o debug-*.png
    if (!/^debug-[\w\-]+\.(html|png)$/.test(filename)) {
      throw new BadRequestException('Nombre de archivo no permitido');
    }

    // (Opcional) Protección por token o variable de entorno
    const allow = process.env.ALLOW_DEBUG_DOWNLOAD === '1' || process.env.NODE_ENV !== 'production';
    if (!allow) {
      throw new BadRequestException('Descarga de debug deshabilitada en producción');
    }

    // Ruta absoluta al archivo (en la raíz del proyecto server)
    const filePath = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Archivo no encontrado');
    }
    return res.sendFile(filePath);
  }
}
