import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateConfig } from './config/env.validation';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { StandingsModule } from './standings/standings.module';
import { TeamModule } from './teams/team.module';
import { PlayerModule } from './players/player.module';
import { CoachModule } from './coaches/coach.module';
import { FootballDataModule } from './football-data/football-data.module';
import { TiktokScraperModule } from './tiktok-scraper/tiktok-scraper.module';
import { MatchModule } from './matches/match.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { LineupModule } from './lineup/lineup.module';
import { StatsModule } from './stats/stats.module';

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
    StandingsModule,
    TeamModule, 
    PlayerModule, 
    CoachModule,
    FootballDataModule,
    TiktokScraperModule,
    MatchModule,
    LineupModule,
    StatsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
