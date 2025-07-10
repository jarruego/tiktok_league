import { Module, forwardRef } from '@nestjs/common';
import { MatchService } from './match.service';
import { MatchController } from './match.controller';
import { MatchSimulationService } from './match-simulation.service';
import { StandingsService } from './standings.service';
import { DatabaseModule } from '../database/database.module';
import { TeamModule } from '../teams/team.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => TeamModule)],
  controllers: [MatchController],
  providers: [MatchService, MatchSimulationService, StandingsService],
  exports: [MatchService, MatchSimulationService, StandingsService],
})
export class MatchModule {}
