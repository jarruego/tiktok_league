import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { LeagueSystemService } from './league-system.service';
import { CreateSeasonDto } from './dto/create-season.dto';

@Controller('league-system')
export class LeagueSystemController {
  constructor(private readonly leagueSystemService: LeagueSystemService) {}

  @Post('initialize')
  async initializeLeagueSystem() {
    return this.leagueSystemService.initializeLeagueSystem();
  }

  @Post('seasons')
  async createSeason(@Body() createSeasonDto: CreateSeasonDto) {
    return this.leagueSystemService.createSeason(createSeasonDto);
  }

  @Get('seasons')
  async getAllSeasons() {
    return this.leagueSystemService.getAllSeasons();
  }

  @Get('seasons/active')
  async getActiveSeason() {
    return this.leagueSystemService.getActiveSeason();
  }

  @Get('structure')
  async getLeagueSystemStructure() {
    return this.leagueSystemService.getLeagueSystemStructure();
  }

  @Post('assign-teams/:seasonId')
  async assignTeamsToLeagues(@Param('seasonId', ParseIntPipe) seasonId: number) {
    return this.leagueSystemService.assignTeamsToLeaguesByTikTokFollowers(seasonId);
  }

  @Get('leagues/:leagueId/teams/:seasonId')
  async getTeamsInLeague(
    @Param('leagueId', ParseIntPipe) leagueId: number,
    @Param('seasonId', ParseIntPipe) seasonId: number
  ) {
    return this.leagueSystemService.getTeamsInLeague(leagueId, seasonId);
  }

  @Post('assign-new-teams/:seasonId')
  async assignNewTeamsToAvailableSlots(
    @Param('seasonId', ParseIntPipe) seasonId: number,
    @Body() { teamIds }: { teamIds: number[] }
  ) {
    return this.leagueSystemService.assignNewTeamsToAvailableSlots(teamIds, seasonId);
  }

  @Get('availability/:seasonId')
  async getLeagueAvailability(@Param('seasonId', ParseIntPipe) seasonId: number) {
    return this.leagueSystemService.getLeagueAvailability(seasonId);
  }
}
