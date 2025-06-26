import { Module, forwardRef } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayerController } from './player.controller';
import { DatabaseModule } from '../database/database.module';
import { TeamModule } from '../teams/team.module';
import { FootballDataModule } from '../football-data/football-data.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => TeamModule), FootballDataModule],
  controllers: [PlayerController],
  providers: [PlayerService],
  exports: [PlayerService],
})
export class PlayerModule {}
