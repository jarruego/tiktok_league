import { Module } from '@nestjs/common';
import { CoachService } from './coach.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [CoachService],
  exports: [CoachService],
})
export class CoachModule {}
