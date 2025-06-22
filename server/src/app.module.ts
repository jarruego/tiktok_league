import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TiktokScraperService } from './tiktok-scraper/tiktok-scraper.service';
import { TiktokScraperController } from './tiktok-scraper/tiktok-scraper.controller';
import { DatabaseModule } from './database/database.module';
import { TeamService } from './teams/team.service';
import { TeamController } from './teams/team.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [DatabaseModule, ScheduleModule.forRoot(), AuthModule],
  controllers: [AppController, TiktokScraperController, TeamController],
  providers: [AppService, TiktokScraperService, TeamService],
})
export class AppModule {}
