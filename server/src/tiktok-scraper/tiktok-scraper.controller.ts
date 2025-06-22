import { Controller, Post, UseGuards } from '@nestjs/common';
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
}
