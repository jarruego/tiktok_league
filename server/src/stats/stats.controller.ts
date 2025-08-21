import { Controller, Get, Query } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('top-scorers')
  getTopScorers(@Query('leagueId') leagueId?: string, @Query('divisionId') divisionId?: string) {
    return this.statsService.getTopScorers({ leagueId, divisionId });
  }

  @Get('top-assists')
  getTopAssists(@Query('leagueId') leagueId?: string, @Query('divisionId') divisionId?: string) {
    return this.statsService.getTopAssists({ leagueId, divisionId });
  }
}
