import { Module } from '@nestjs/common';
import { StandingsService } from './standings.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [StandingsService],
  exports: [StandingsService],
})
export class StandingsModule {}
