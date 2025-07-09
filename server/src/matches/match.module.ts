import { Module } from '@nestjs/common';
import { MatchService } from './match.service';
import { MatchController } from './match.controller';
import { MatchSimulationService } from './match-simulation.service';
import { StandingsService } from './standings.service';
import { DatabaseModule } from '../database/database.module';
import { SeasonTransitionService } from '../teams/season-transition.service';
import { SeasonTransitionAssignmentService } from '../teams/season-transition-assignment.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MatchController],
  providers: [MatchService, MatchSimulationService, StandingsService, SeasonTransitionService, SeasonTransitionAssignmentService],
  exports: [MatchService, MatchSimulationService, StandingsService],
})
export class MatchModule {}
