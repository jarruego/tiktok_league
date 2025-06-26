import { Controller, Post, UseGuards, Param, ParseIntPipe } from '@nestjs/common';
import { TiktokScraperService } from './tiktok-scraper.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
}
