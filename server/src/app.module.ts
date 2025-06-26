import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TiktokScraperService } from './tiktok-scraper/tiktok-scraper.service';
import { TiktokScraperController } from './tiktok-scraper/tiktok-scraper.controller';
import { DatabaseModule } from './database/database.module';
import { TeamModule } from './teams/team.module';
import { PlayerModule } from './players/player.module';
import { CoachModule } from './coaches/coach.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot(), AuthModule, TeamModule, PlayerModule, CoachModule],
  controllers: [AppController, TiktokScraperController],
  providers: [AppService, TiktokScraperService],
})
export class AppModule {}
