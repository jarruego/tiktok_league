import { Module } from '@nestjs/common';
import { LineupController } from './lineup.controller';
import { LineupService } from './lineup.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [LineupService],
  controllers: [LineupController],
})
export class LineupModule {}
