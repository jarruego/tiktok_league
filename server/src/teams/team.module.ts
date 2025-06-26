import { Module } from '@nestjs/common';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { LeagueSystemService } from './league-system.service';
import { LeagueSystemController } from './league-system.controller';
import { DatabaseModule } from '../database/database.module';
import { CoachModule } from '../coaches/coach.module';

@Module({
  imports: [DatabaseModule, CoachModule],
  controllers: [TeamController, LeagueSystemController],
  providers: [TeamService, LeagueSystemService],
  exports: [TeamService, LeagueSystemService],
})
export class TeamModule {}
