import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateConfig } from './config/env.validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TiktokScraperService } from './tiktok-scraper/tiktok-scraper.service';
import { TiktokScraperController } from './tiktok-scraper/tiktok-scraper.controller';
import { DatabaseModule } from './database/database.module';
import { TeamModule } from './teams/team.module';
import { PlayerModule } from './players/player.module';
import { CoachModule } from './coaches/coach.module';
import { FootballDataModule } from './football-data/football-data.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateConfig,
    }),
    DatabaseModule, 
    ScheduleModule.forRoot(), 
    AuthModule, 
    TeamModule, 
    PlayerModule, 
    CoachModule,
    FootballDataModule
  ],
  controllers: [AppController, TiktokScraperController],
  providers: [AppService, TiktokScraperService],
})
export class AppModule {}
