import { Controller, Get, Post, Param, Body, NotFoundException } from '@nestjs/common';
import { LineupService } from './lineup.service';
import { SaveLineupDto } from './dto/save-lineup.dto';

@Controller('teams/:teamId/lineup')
export class LineupController {
  constructor(private readonly lineupService: LineupService) {}

  @Get()
  async getLineup(@Param('teamId') teamId: number) {
    const lineup = await this.lineupService.getLineup(Number(teamId));
    if (!lineup) throw new NotFoundException('No hay alineación guardada');
    return lineup.lineup;
  }

  @Post()
  async saveLineup(@Param('teamId') teamId: number, @Body() dto: SaveLineupDto) {
    const saved = await this.lineupService.saveLineup(Number(teamId), dto);
    return saved.lineup;
  }
}
