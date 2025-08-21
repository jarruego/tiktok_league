import { Controller, Get, Query, Param, ParseIntPipe } from '@nestjs/common';
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

  @Get('all-stats')
  getAllStats(@Query('leagueId') leagueId?: string, @Query('divisionId') divisionId?: string) {
    return this.statsService.getAllStats({ leagueId, divisionId });
  }

  @Get('player/:id')
  async getPlayerStats(@Param('id', ParseIntPipe) id: number) {
    return this.statsService.getPlayerStats(id);
  }

  @Get('player/:id/progress')
  async getPlayerProgress(@Param('id', ParseIntPipe) id: number) {
    return this.statsService.getPlayerProgress(id);
  }
}
