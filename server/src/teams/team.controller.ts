import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { Request } from 'express';
import { TeamService } from  './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { FootballDataTeamResponseDto } from '../players/dto/football-data.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // Solo usuarios autenticados pueden crear, actualizar o borrar equipos
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createTeamDto: CreateTeamDto) {
    return this.teamService.create(createTeamDto);
  }

  @Get()
  findAll() {
    // Consulta pública con información completa incluyendo entrenadores
    return this.teamService.findAllWithCoaches();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.teamService.findOne(Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTeamDto: UpdateTeamDto) {
    return this.teamService.update(Number(id), updateTeamDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.teamService.remove(Number(id));
  }

  // Endpoint para actualizar equipo con información de Football-Data.org
  @UseGuards(JwtAuthGuard)
  @Patch(':id/football-data')
  updateWithFootballData(
    @Param('id') id: string, 
    @Body() footballDataTeam: FootballDataTeamResponseDto
  ) {
    return this.teamService.updateWithFootballData(Number(id), footballDataTeam);
  }

  // Endpoint para asociar un equipo local con Football-Data ID
  @UseGuards(JwtAuthGuard)
  @Patch(':id/map-football-data/:footballDataId')
  async mapToFootballData(
    @Param('id', ParseIntPipe) id: number,
    @Param('footballDataId', ParseIntPipe) footballDataId: number
  ) {
    // Solo actualizar el footballDataId sin cambiar otros datos
    const updatedTeam = await this.teamService.update(id, { footballDataId });
    return {
      message: `Team ${updatedTeam.name} mapped to Football-Data ID ${footballDataId}`,
      team: updatedTeam
    };
  }

  // Nuevo endpoint: crear equipo para usuario autenticado
  @UseGuards(JwtAuthGuard)
  @Post('create-for-user')
  async createForUser(@Body('name') name: string, @Req() req: Request) {
    const user = req.user as any;
    if (!user || !user.username) {
      return { success: false, message: 'Usuario no autenticado' };
    }
    const result = await this.teamService.createTeamForUser(user.username, name);
    return result;
  }
}
