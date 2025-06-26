import { Module } from '@nestjs/common';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { DatabaseModule } from '../database/database.module';
import { CoachModule } from '../coaches/coach.module';

@Module({
  imports: [DatabaseModule, CoachModule],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
