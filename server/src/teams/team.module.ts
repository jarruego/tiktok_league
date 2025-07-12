import { Module, forwardRef } from '@nestjs/common';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { LeagueSystemService } from './league-system.service';
import { LeagueSystemController } from './league-system.controller';
import { SeasonTransitionService } from './season-transition.service';
import { SeasonTransitionController } from './season-transition.controller';
import { SeasonTransitionAssignmentService } from './season-transition-assignment.service';
import { DatabaseModule } from '../database/database.module';
import { CoachModule } from '../coaches/coach.module';
import { StandingsModule } from '../standings/standings.module';
import { MatchModule } from '../matches/match.module';
import { PlayoffStatusService } from '../services/playoff-status.service';

@Module({
  imports: [DatabaseModule, CoachModule, StandingsModule, forwardRef(() => MatchModule)],
  controllers: [TeamController, LeagueSystemController, SeasonTransitionController],
  providers: [TeamService, LeagueSystemService, SeasonTransitionService, SeasonTransitionAssignmentService,PlayoffStatusService],
  exports: [TeamService, LeagueSystemService, SeasonTransitionService, SeasonTransitionAssignmentService],
})
export class TeamModule {}
