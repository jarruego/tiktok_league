import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { teamTable, coachTable, userTable } from '../database/schema';
import * as schema from '../database/schema';
import { eq } from 'drizzle-orm';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { FootballDataTeamResponseDto } from '../players/dto/football-data.dto';
import { CoachService } from '../coaches/coach.service';
import { DATABASE_PROVIDER } from '../database/database.module';
import { UsersService } from '../auth/users.service';
import { StandingsService } from '../standings/standings.service';

@Injectable()
export class TeamService {
  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
    private readonly coachService: CoachService,
    private readonly usersService: UsersService,
    private readonly standingsService: StandingsService,
  ) {}

  // Asigna el mejor equipo bot disponible al usuario, cambiando el nombre y tiktokId
  async assignTeamForUser(username: string, name: string, tiktokId?: string) {
    const db = this.databaseService.db;
    // Buscar usuario por username
    const [user] = await db.select().from(userTable).where(eq(userTable.username, username));
    if (!user) {
      return { success: false, message: 'Usuario no encontrado' };
    }
    if (user.teamId) {
      return { success: false, message: 'Ya tienes un equipo asignado', teamId: user.teamId };
    }
    // Buscar divisiones ordenadas por nivel ascendente (más alta primero)
    const divisions = await db.select().from(schema.divisionTable).orderBy(schema.divisionTable.level);
    let assignedTeam: any = null;
    // Buscar la temporada activa (puedes ajustar esto según tu lógica)
    const [activeSeason] = await db.select().from(schema.seasonTable).where(eq(schema.seasonTable.isActive, true));
    if (!activeSeason) {
      return { success: false, message: 'No hay temporada activa' };
    }
    for (const division of divisions) {
      // Buscar ligas de la división
      const leagues = await db.select().from(schema.leagueTable).where(eq(schema.leagueTable.divisionId, division.id));
      for (const league of leagues) {
        // Usar StandingsService para obtener el mejor bot libre en la liga
        const teamId = await this.standingsService.getBestRankedBotTeam(activeSeason.id, league.id);
        if (teamId) {
          // Asignar el equipo al usuario y actualizar el equipo
          await db.update(userTable).set({ teamId }).where(eq(userTable.id, user.id));
          await db.update(teamTable).set({ isBot: 0, name, tiktokId: tiktokId || username }).where(eq(teamTable.id, teamId));
          assignedTeam = await db.select().from(teamTable).where(eq(teamTable.id, teamId)).then(r => r[0]);
          break;
        }
      }
      if (assignedTeam) break;
    }
    if (!assignedTeam) {
      return { success: false, message: 'No hay equipos disponibles para asignar' };
    }
    return { success: true, teamId: assignedTeam.id, team: assignedTeam };
  }

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
    const [team] = await db
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
        competitionId: teamTable.competitionId,
        clubColors: teamTable.clubColors,
        // Información del área/país
        areaId: teamTable.areaId,
        areaName: teamTable.areaName,
        areaCode: teamTable.areaCode,
        areaFlag: teamTable.areaFlag,
        // Información de TikTok
        tiktokId: teamTable.tiktokId,
        displayName: teamTable.displayName,
        followers: teamTable.followers,
        following: teamTable.following,
        likes: teamTable.likes,
        description: teamTable.description,
        profileUrl: teamTable.profileUrl,
        avatarUrl: teamTable.avatarUrl,
        lastScrapedAt: teamTable.lastScrapedAt,
        // Timestamps
        createdAt: teamTable.createdAt,
        updatedAt: teamTable.updatedAt,
        // Entrenador
        coach: {
          id: coachTable.id,
          name: coachTable.name,
          nationality: coachTable.nationality,
          footballDataId: coachTable.footballDataId,
        }
      })
      .from(teamTable)
      .leftJoin(coachTable, eq(teamTable.coachId, coachTable.id))
      .where(eq(teamTable.id, id));
    
    if (!team) throw new NotFoundException('Team not found');
    
    // Si no hay entrenador, eliminar el objeto coach vacío
    if (!team.coach?.id) {
      team.coach = null;
    }
    
    return team;
  }

  async update(id: number, updateTeamDto: UpdateTeamDto) {
    const db = this.databaseService.db;
    // Solo permitir actualizar campos válidos
    const allowedFields: (keyof UpdateTeamDto)[] = [
      'name', 'primaryColor', 'secondaryColor', 'shortName', 'tla', 'crest', 'venue', 'founded', 'website', 'clubColors',
      'areaId', 'areaName', 'areaCode', 'areaFlag', 'coachId', 'displayName', 'followers', 'following', 'likes', 'description', 'profileUrl', 'avatarUrl', 'footballDataId', 'competitionId'
    ];
    const updateData: Partial<UpdateTeamDto> = {};
    for (const key of allowedFields) {
      if (key in updateTeamDto) {
        (updateData as any)[key] = (updateTeamDto as any)[key];
      }
    }
    (updateData as any).updatedAt = new Date();
    const [team] = await db
      .update(teamTable)
      .set(updateData)
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

  async updateWithFootballData(
    teamId: number, 
    footballDataTeam: FootballDataTeamResponseDto,
    competitionId?: number
  ) {
    const db = this.databaseService.db;
    
    // Verificar que el equipo existe
    const [existingTeam] = await db.select().from(teamTable).where(eq(teamTable.id, teamId));
    if (!existingTeam) {
      throw new NotFoundException('Team not found');
    }

    let coachId: number | undefined = undefined;
    let coachResult: any = null;

    // Manejar entrenador si existe y tiene datos válidos
    if (footballDataTeam.coach && footballDataTeam.coach.name) {
      try {
        const coach = await this.coachService.createOrUpdateSafely({
          name: footballDataTeam.coach.name,
          footballDataId: footballDataTeam.coach.id,
          nationality: footballDataTeam.coach.nationality,
        });
        
        if (coach) {
          coachId = coach.id;
          coachResult = coach;
        }
      } catch (error) {
        console.warn('Could not create/update coach, continuing without coach:', error.message);
        coachResult = { error: 'Coach data incomplete or invalid' };
      }
    } else {
      console.log('No valid coach data available for this team');
      coachResult = { skipped: 'No coach data available' };
    }

    // Actualizar equipo con información de Football-Data.org
    const updateData: Partial<CreateTeamDto> = {
      footballDataId: footballDataTeam.id,
      competitionId: competitionId, // Añadir competitionId
      shortName: footballDataTeam.shortName,
      tla: footballDataTeam.tla,
      crest: footballDataTeam.crest,
      venue: footballDataTeam.venue,
      founded: footballDataTeam.founded,
      website: footballDataTeam.website,
      clubColors: footballDataTeam.clubColors,
      // Información del área/país
      areaId: footballDataTeam.area?.id,
      areaName: footballDataTeam.area?.name,
      areaCode: footballDataTeam.area?.code,
      areaFlag: footballDataTeam.area?.flag,
      coachId: coachId,
    };

    const [updatedTeam] = await db
      .update(teamTable)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(teamTable.id, teamId))
      .returning();

    return {
      team: updatedTeam,
      coach: coachResult,
      message: coachId 
        ? 'Team and coach updated with Football-Data.org information'
        : 'Team updated with Football-Data.org information (coach data unavailable or incomplete)'
    };
  }

  async findAllWithCoaches() {
    const db = this.databaseService.db;
    
    const teams = await db
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
        competitionId: teamTable.competitionId,
        clubColors: teamTable.clubColors,
        // Información del área/país
        areaId: teamTable.areaId,
        areaName: teamTable.areaName,
        areaCode: teamTable.areaCode,
        areaFlag: teamTable.areaFlag,
        // Información de TikTok
        tiktokId: teamTable.tiktokId,
        displayName: teamTable.displayName,
        followers: teamTable.followers,
        following: teamTable.following,
        likes: teamTable.likes,
        description: teamTable.description,
        profileUrl: teamTable.profileUrl,
        avatarUrl: teamTable.avatarUrl,
        lastScrapedAt: teamTable.lastScrapedAt,
        // Timestamps
        createdAt: teamTable.createdAt,
        updatedAt: teamTable.updatedAt,
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

    // Limpiar coaches vacíos
    return teams.map(team => ({
      ...team,
      coach: team.coach?.id ? team.coach : null
    }));
  }

    // Actualizar solo el nombre del equipo
  async updateTeamName(id: number, name: string) {
    const db = this.databaseService.db;
    const [team] = await db
      .update(teamTable)
      .set({ name, updatedAt: new Date() })
      .where(eq(teamTable.id, id))
      .returning();
    if (!team) {
      throw new Error('Equipo no encontrado');
    }
    return { message: 'Nombre actualizado correctamente', team };
  }
}
