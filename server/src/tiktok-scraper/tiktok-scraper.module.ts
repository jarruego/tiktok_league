import { Module } from '@nestjs/common';
import { TiktokScraperService } from './tiktok-scraper.service';
import { TiktokScraperController } from './tiktok-scraper.controller';
import { TiktokScraperDebugController } from './tiktok-scraper-debug.controller';
import { DatabaseModule } from '../database/database.module';
import { FootballDataModule } from '../football-data/football-data.module';
import { PlayerModule } from '../players/player.module';

@Module({
  imports: [
    DatabaseModule,
    FootballDataModule,
    PlayerModule,
  ],
  controllers: [TiktokScraperController, TiktokScraperDebugController],
  providers: [TiktokScraperService],
  exports: [TiktokScraperService],
})
export class TiktokScraperModule {}
