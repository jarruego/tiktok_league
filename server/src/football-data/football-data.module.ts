import { Module } from '@nestjs/common';
import { FootballDataService } from './football-data.service';
import { FootballDataController } from './football-data.controller';
import { FootballDataCacheService } from './football-data-cache.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [FootballDataController],
  providers: [FootballDataService, FootballDataCacheService],
  exports: [FootballDataService, FootballDataCacheService],
})
export class FootballDataModule {}
