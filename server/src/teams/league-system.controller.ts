import { Controller, Get, Post, Body, Param, ParseIntPipe, Delete } from '@nestjs/common';
import { LeagueSystemService } from './league-system.service';
import { CreateSeasonDto } from './dto/create-season.dto';

@Controller('league-system')
export class LeagueSystemController {
  constructor(private readonly leagueSystemService: LeagueSystemService) {}

  @Get('status')
  async getSystemStatus() {
    const isInitialized = await this.leagueSystemService.isSystemInitialized();
    const hasAssignments = await this.leagueSystemService.hasExistingAssignments();
    
    return {
      isInitialized,
      hasAssignments,
      message: isInitialized 
        ? 'Sistema inicializado' 
        : 'Sistema no inicializado'
    };
  }

  @Post('initialize')
  async initializeLeagueSystem() {
    return this.leagueSystemService.initializeLeagueSystem();
  }

  @Delete('reset')
  async resetLeagueSystem() {
    return this.leagueSystemService.resetLeagueSystem();
  }

  @Get('assignments/:seasonId/status')
  async getAssignmentStatus(@Param('seasonId', ParseIntPipe) seasonId: number) {
    const hasAssignments = await this.leagueSystemService.hasExistingAssignments(seasonId);
    return {
      seasonId,
      hasAssignments,
      message: hasAssignments 
        ? 'Ya hay asignaciones para esta temporada' 
        : 'No hay asignaciones para esta temporada'
    };
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
