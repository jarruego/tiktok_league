import { Module, forwardRef } from '@nestjs/common';
import { MatchService } from './match.service';
import { MatchController } from './match.controller';
import { MatchSimulationService } from './match-simulation.service';
import { DatabaseModule } from '../database/database.module';
import { StandingsModule } from '../standings/standings.module';
import { TeamModule } from '../teams/team.module';

@Module({
  imports: [DatabaseModule, StandingsModule, forwardRef(() => TeamModule)],
  controllers: [MatchController],
  providers: [MatchService, MatchSimulationService],
  exports: [MatchService, MatchSimulationService],
})
export class MatchModule {}
