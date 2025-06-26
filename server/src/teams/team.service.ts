import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { teamTable, coachTable } from '../database/schema';
import { eq } from 'drizzle-orm';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { FootballDataTeamResponseDto } from '../players/dto/football-data.dto';
import { CoachService } from '../coaches/coach.service';
import { Inject } from '@nestjs/common';
import { DATABASE_PROVIDER } from '../database/database.module';

@Injectable()
export class TeamService {
  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
    private readonly coachService: CoachService,
  ) {}

  async create(createTeamDto: CreateTeamDto) {
    const db = this.databaseService.db;
    const [team] = await db.insert(teamTable).values(createTeamDto).returning();
    return team;
  }

  async findAll() {
    const db = this.databaseService.db;
    return db.select().from(teamTable);
  }

  async findOne(id: number) {
    const db = this.databaseService.db;
    const [team] = await db.select().from(teamTable).where(eq(teamTable.id, id));
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async update(id: number, updateTeamDto: UpdateTeamDto) {
    const db = this.databaseService.db;
    const [team] = await db
      .update(teamTable)
      .set(updateTeamDto)
      .where(eq(teamTable.id, id))
      .returning();
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async remove(id: number) {
    const db = this.databaseService.db;
    const [team] = await db
      .delete(teamTable)
      .where(eq(teamTable.id, id))
      .returning();
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async updateWithFootballData(teamId: number, footballDataTeam: FootballDataTeamResponseDto) {
    const db = this.databaseService.db;
    
    // Verificar que el equipo existe
    const [existingTeam] = await db.select().from(teamTable).where(eq(teamTable.id, teamId));
    if (!existingTeam) {
      throw new NotFoundException('Team not found');
    }

    let coachId: number | undefined = undefined;

    // Manejar entrenador si existe
    if (footballDataTeam.coach) {
      const coach = await this.coachService.createOrUpdate({
        name: footballDataTeam.coach.name,
        footballDataId: footballDataTeam.coach.id,
        nationality: footballDataTeam.coach.nationality,
      });
      coachId = coach.id;
    }

    // Actualizar equipo con información de Football-Data.org
    const updateData: Partial<CreateTeamDto> = {
      footballDataId: footballDataTeam.id,
      shortName: footballDataTeam.shortName,
      tla: footballDataTeam.tla,
      crest: footballDataTeam.crest,
      venue: footballDataTeam.venue,
      founded: footballDataTeam.founded,
      website: footballDataTeam.website,
      clubColors: footballDataTeam.clubColors,
      coachId: coachId,
    };

    const [updatedTeam] = await db
      .update(teamTable)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(teamTable.id, teamId))
      .returning();

    return {
      team: updatedTeam,
      coach: coachId ? await this.coachService.findOne(coachId) : null,
      message: 'Team updated with Football-Data.org information'
    };
  }

  async findAllWithCoaches() {
    const db = this.databaseService.db;
    
    return db
      .select({
        id: teamTable.id,
        name: teamTable.name,
        shortName: teamTable.shortName,
        tla: teamTable.tla,
        crest: teamTable.crest,
        venue: teamTable.venue,
        founded: teamTable.founded,
        website: teamTable.website,
        footballDataId: teamTable.footballDataId,
        // Información de TikTok
        tiktokId: teamTable.tiktokId,
        displayName: teamTable.displayName,
        followers: teamTable.followers,
        following: teamTable.following,
        likes: teamTable.likes,
        // Entrenador
        coach: {
          id: coachTable.id,
          name: coachTable.name,
          nationality: coachTable.nationality,
          footballDataId: coachTable.footballDataId,
        }
      })
      .from(teamTable)
      .leftJoin(coachTable, eq(teamTable.coachId, coachTable.id));
  }
}
