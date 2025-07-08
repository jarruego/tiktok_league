import { Controller, Post, UseGuards, Param, ParseIntPipe, Get } from '@nestjs/common';
import { TiktokScraperService } from './tiktok-scraper.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import puppeteer from 'puppeteer';

@Controller('scraper')
export class TiktokScraperController {
  constructor(private readonly scraperService: TiktokScraperService) {}

  // Solo usuarios autenticados pueden lanzar el scraping manual
  @UseGuards(JwtAuthGuard)
  @Post('update')
  async updateFollowers() {
    return this.scraperService.updateFollowers();
  }

  // Endpoint para forzar auto-import de un equipo específico (útil para testing)
  @UseGuards(JwtAuthGuard)
  @Post('auto-import/:teamId')
  async forceAutoImport(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.scraperService.forceAutoImportForTeam(teamId);
  }

  // Endpoint para obtener estadísticas del scraping
  @UseGuards(JwtAuthGuard)
  @Get('stats')
  async getStats() {
    return this.scraperService.getScrapingStats();
  }

  // Endpoint para resetear contadores de equipos problemáticos
  @UseGuards(JwtAuthGuard)
  @Post('reset-failed-teams')
  async resetFailedTeams() {
    return this.scraperService.resetFailedTeamsCounters();
  }

  // Endpoint para probar scraping de un equipo específico
  @UseGuards(JwtAuthGuard)
  @Post('test-team/:teamId')
  async testTeam(@Param('teamId', ParseIntPipe) teamId: number) {
    return this.scraperService.testScrapingForTeam(teamId);
  }

  // Endpoint para diagnosticar problemas con Puppeteer
  @UseGuards(JwtAuthGuard)
  @Get('diagnostic')
  async puppeteerDiagnostic() {
    try {
      const diagnostic = {
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          nodeEnv: process.env.NODE_ENV || 'development',
          isRender: !!(process.env.RENDER || process.env.RENDER_SERVICE_ID),
          puppeteerCacheDir: process.env.PUPPETEER_CACHE_DIR || 'no configurado'
        },
        puppeteerTest: null as any,
        timestamp: new Date()
      };

      // Configuración específica para el entorno (actualizada para coincidir con el servicio)
      const isProduction = process.env.NODE_ENV === 'production';
      const isRender = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID;
      
      const puppeteerConfig = isProduction || isRender ? {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images',
          '--enable-automation=false',
          '--disable-blink-features=AutomationControlled'
        ],
        ignoreDefaultArgs: ['--enable-automation'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      } : {
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--enable-automation=false',
          '--disable-blink-features=AutomationControlled'
        ],
        ignoreDefaultArgs: ['--enable-automation']
      };

      // Intentar lanzar Puppeteer
      let browser;
      try {
        browser = await puppeteer.launch(puppeteerConfig);
        const version = await browser.version();
        
        // Crear página de prueba
        const page = await browser.newPage();
        await page.goto('https://www.google.com', { waitUntil: 'networkidle2', timeout: 15000 });
        const title = await page.title();
        
        await page.close();
        await browser.close();

        diagnostic.puppeteerTest = {
          success: true,
          browserVersion: version,
          testPageTitle: title,
          message: 'Puppeteer está funcionando correctamente'
        };

      } catch (error) {
        if (browser) {
          await browser.close();
        }
        
        diagnostic.puppeteerTest = {
          success: false,
          error: error.message,
          message: 'Error al lanzar Puppeteer'
        };
      }

      return diagnostic;

    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}
