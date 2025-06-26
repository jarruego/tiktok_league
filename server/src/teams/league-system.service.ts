import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { 
  divisionTable, 
  leagueTable, 
  seasonTable, 
  teamLeagueAssignmentTable,
  teamTable,
  AssignmentReason
} from '../database/schema';
import { eq, desc, asc, sql } from 'drizzle-orm';
import { CreateDivisionDto } from './dto/create-division.dto';
import { CreateLeagueDto } from './dto/create-league.dto';
import { CreateSeasonDto } from './dto/create-season.dto';
import { Inject } from '@nestjs/common';
import { DATABASE_PROVIDER } from '../database/database.module';

@Injectable()
export class LeagueSystemService {
  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Inicializa la estructura completa de divisiones y ligas según las especificaciones
   */
  async initializeLeagueSystem() {
    const db = this.databaseService.db;
    
    // Configuración de divisiones según las especificaciones
    const divisionsConfig = [
      {
        level: 1,
        name: 'División 1',
        description: 'Primera División - Elite',
        totalLeagues: 1,
        teamsPerLeague: 20,
        promoteSlots: 0,
        promotePlayoffSlots: 0,
        relegateSlots: 3,
        europeanSlots: 7 // Top 7 van a competiciones europeas
      },
      {
        level: 2,
        name: 'División 2',
        description: 'Segunda División',
        totalLeagues: 1,
        teamsPerLeague: 20,
        promoteSlots: 2,
        promotePlayoffSlots: 4, // 3º al 6º juegan playoff
        relegateSlots: 3,
        europeanSlots: 0
      },
      {
        level: 3,
        name: 'División 3',
        description: 'Tercera División',
        totalLeagues: 2,
        teamsPerLeague: 20,
        promoteSlots: 2, // 1º de cada grupo
        promotePlayoffSlots: 4, // 2º y 3º de cada grupo
        relegateSlots: 6, // 3 últimos de cada grupo
        europeanSlots: 0
      },
      {
        level: 4,
        name: 'División 4',
        description: 'Cuarta División',
        totalLeagues: 4,
        teamsPerLeague: 20,
        promoteSlots: 4, // 1º de cada grupo
        promotePlayoffSlots: 4, // 2ºs juegan playoff por 2 plazas
        relegateSlots: 12, // 3 últimos de cada grupo
        europeanSlots: 0
      },
      {
        level: 5,
        name: 'División 5',
        description: 'Quinta División',
        totalLeagues: 8,
        teamsPerLeague: 20,
        promoteSlots: 8, // 1º de cada grupo
        promotePlayoffSlots: 8, // 2ºs juegan playoff por 4 plazas
        relegateSlots: 0, // No hay descensos (última división)
        europeanSlots: 0
      }
    ];

    // Crear divisiones
    for (const divisionConfig of divisionsConfig) {
      const [division] = await db
        .insert(divisionTable)
        .values(divisionConfig)
        .onConflictDoUpdate({
          target: divisionTable.level,
          set: divisionConfig
        })
        .returning();

      // Crear ligas para cada división
      const groupCodes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      
      for (let i = 0; i < divisionConfig.totalLeagues; i++) {
        const groupCode = divisionConfig.totalLeagues === 1 ? 'A' : groupCodes[i];
        const leagueName = divisionConfig.totalLeagues === 1 
          ? divisionConfig.name 
          : `${divisionConfig.name} - Grupo ${groupCode}`;

        await db
          .insert(leagueTable)
          .values({
            name: leagueName,
            groupCode: groupCode,
            divisionId: division.id,
            maxTeams: divisionConfig.teamsPerLeague,
            description: `Grupo ${groupCode} de ${divisionConfig.name}`
          })
          .onConflictDoNothing();
      }
    }

    return { message: 'Sistema de ligas inicializado correctamente' };
  }

  /**
   * Asigna todos los equipos a ligas basándose en sus seguidores de TikTok
   */
  async assignTeamsToLeaguesByTikTokFollowers(seasonId: number) {
    const db = this.databaseService.db;

    // Obtener todos los equipos ordenados por seguidores de TikTok (descendente)
    const teams = await db
      .select()
      .from(teamTable)
      .orderBy(desc(teamTable.followers));

    if (teams.length === 0) {
      throw new BadRequestException('No hay equipos para asignar');
    }

    // Obtener todas las ligas ordenadas por nivel de división y grupo
    const leagues = await db
      .select({
        id: leagueTable.id,
        name: leagueTable.name,
        groupCode: leagueTable.groupCode,
        maxTeams: leagueTable.maxTeams,
        divisionId: leagueTable.divisionId,
        divisionLevel: divisionTable.level
      })
      .from(leagueTable)
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .orderBy(asc(divisionTable.level), asc(leagueTable.groupCode));

    // Calcular cuántos equipos caben en total
    const totalCapacity = leagues.reduce((sum, league) => sum + league.maxTeams, 0);
    
    if (teams.length > totalCapacity) {
      throw new BadRequestException(
        `Hay ${teams.length} equipos pero solo capacidad para ${totalCapacity}`
      );
    }

    // Asignar equipos a ligas
    let teamIndex = 0;
    const assignments: any[] = [];

    for (const league of leagues) {
      for (let i = 0; i < league.maxTeams && teamIndex < teams.length; i++) {
        const team = teams[teamIndex];
        
        assignments.push({
          teamId: team.id,
          leagueId: league.id,
          seasonId: seasonId,
          tiktokFollowersAtAssignment: team.followers,
          assignmentReason: AssignmentReason.INITIAL_TIKTOK
        });
        
        teamIndex++;
      }
    }

    // Insertar asignaciones en lotes
    if (assignments.length > 0) {
      await db.insert(teamLeagueAssignmentTable).values(assignments);
    }

    return {
      message: `${assignments.length} equipos asignados a ligas`,
      assignedTeams: assignments.length,
      totalTeams: teams.length
    };
  }

  /**
   * Asigna nuevos equipos a ligas disponibles empezando por las divisiones superiores
   * Se usa cuando se registran nuevos equipos después de la asignación inicial
   */
  async assignNewTeamsToAvailableSlots(teamIds: number[], seasonId: number) {
    const db = this.databaseService.db;

    // Verificar que los equipos no estén ya asignados en esta temporada
    const alreadyAssigned = await db
      .select({ teamId: teamLeagueAssignmentTable.teamId })
      .from(teamLeagueAssignmentTable)
      .where(
        sql`${teamLeagueAssignmentTable.teamId} IN (${teamIds.join(',')}) AND ${teamLeagueAssignmentTable.seasonId} = ${seasonId}`
      );

    const alreadyAssignedIds = alreadyAssigned.map(a => a.teamId);
    const availableTeamIds = teamIds.filter(id => !alreadyAssignedIds.includes(id));

    if (availableTeamIds.length === 0) {
      return {
        message: 'Todos los equipos ya están asignados a ligas en esta temporada',
        assignedTeams: 0
      };
    }

    // Obtener información de los equipos
    const teams = await db
      .select()
      .from(teamTable)
      .where(sql`${teamTable.id} IN (${availableTeamIds.join(',')})`);

    // Obtener ligas con espacios disponibles, ordenadas por nivel de división (superior a inferior)
    const leaguesWithSpace = await db
      .select({
        leagueId: leagueTable.id,
        leagueName: leagueTable.name,
        groupCode: leagueTable.groupCode,
        maxTeams: leagueTable.maxTeams,
        divisionLevel: divisionTable.level,
        currentTeams: sql<number>`COUNT(${teamLeagueAssignmentTable.teamId})`.as('currentTeams')
      })
      .from(leagueTable)
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .leftJoin(
        teamLeagueAssignmentTable,
        sql`${leagueTable.id} = ${teamLeagueAssignmentTable.leagueId} AND ${teamLeagueAssignmentTable.seasonId} = ${seasonId}`
      )
      .groupBy(leagueTable.id, leagueTable.name, leagueTable.groupCode, leagueTable.maxTeams, divisionTable.level)
      .having(sql`COUNT(${teamLeagueAssignmentTable.teamId}) < ${leagueTable.maxTeams}`)
      .orderBy(asc(divisionTable.level), asc(leagueTable.groupCode));

    if (leaguesWithSpace.length === 0) {
      throw new BadRequestException('No hay espacios disponibles en ninguna liga');
    }

    // Asignar equipos a las ligas con espacios disponibles
    const assignments: any[] = [];
    let teamIndex = 0;

    for (const league of leaguesWithSpace) {
      const availableSlots = league.maxTeams - league.currentTeams;
      
      for (let i = 0; i < availableSlots && teamIndex < teams.length; i++) {
        const team = teams[teamIndex];
        
        assignments.push({
          teamId: team.id,
          leagueId: league.leagueId,
          seasonId: seasonId,
          tiktokFollowersAtAssignment: team.followers,
          assignmentReason: AssignmentReason.LATER_AVAILABILITY
        });
        
        teamIndex++;
      }

      if (teamIndex >= teams.length) break;
    }

    // Insertar asignaciones
    if (assignments.length > 0) {
      await db.insert(teamLeagueAssignmentTable).values(assignments);
    }

    return {
      message: `${assignments.length} equipos asignados a ligas disponibles`,
      assignedTeams: assignments.length,
      totalRequestedTeams: teamIds.length,
      alreadyAssignedTeams: alreadyAssignedIds.length,
      unassignedTeams: teams.length - assignments.length
    };
  }

  /**
   * Obtiene la estructura completa de divisiones y ligas
   */
  async getLeagueSystemStructure() {
    const db = this.databaseService.db;

    const result = await db
      .select({
        divisionId: divisionTable.id,
        divisionLevel: divisionTable.level,
        divisionName: divisionTable.name,
        divisionDescription: divisionTable.description,
        totalLeagues: divisionTable.totalLeagues,
        teamsPerLeague: divisionTable.teamsPerLeague,
        promoteSlots: divisionTable.promoteSlots,
        promotePlayoffSlots: divisionTable.promotePlayoffSlots,
        relegateSlots: divisionTable.relegateSlots,
        europeanSlots: divisionTable.europeanSlots,
        leagueId: leagueTable.id,
        leagueName: leagueTable.name,
        groupCode: leagueTable.groupCode,
        maxTeams: leagueTable.maxTeams
      })
      .from(divisionTable)
      .leftJoin(leagueTable, eq(divisionTable.id, leagueTable.divisionId))
      .orderBy(asc(divisionTable.level), asc(leagueTable.groupCode));

    // Agrupar por división
    const divisions = result.reduce((acc, row) => {
      const divisionKey = row.divisionId;
      
      if (!acc[divisionKey]) {
        acc[divisionKey] = {
          id: row.divisionId,
          level: row.divisionLevel,
          name: row.divisionName,
          description: row.divisionDescription,
          totalLeagues: row.totalLeagues,
          teamsPerLeague: row.teamsPerLeague,
          promoteSlots: row.promoteSlots,
          promotePlayoffSlots: row.promotePlayoffSlots,
          relegateSlots: row.relegateSlots,
          europeanSlots: row.europeanSlots,
          leagues: []
        };
      }

      if (row.leagueId) {
        acc[divisionKey].leagues.push({
          id: row.leagueId,
          name: row.leagueName,
          groupCode: row.groupCode,
          maxTeams: row.maxTeams
        });
      }

      return acc;
    }, {});

    return Object.values(divisions);
  }

  /**
   * Obtiene los equipos asignados a una liga específica en una temporada
   */
  async getTeamsInLeague(leagueId: number, seasonId: number) {
    const db = this.databaseService.db;

    return await db
      .select({
        teamId: teamTable.id,
        teamName: teamTable.name,
        shortName: teamTable.shortName,
        crest: teamTable.crest,
        tiktokFollowers: teamTable.followers,
        followersAtAssignment: teamLeagueAssignmentTable.tiktokFollowersAtAssignment,
        assignmentReason: teamLeagueAssignmentTable.assignmentReason
      })
      .from(teamLeagueAssignmentTable)
      .innerJoin(teamTable, eq(teamLeagueAssignmentTable.teamId, teamTable.id))
      .where(
        sql`${teamLeagueAssignmentTable.leagueId} = ${leagueId} AND ${teamLeagueAssignmentTable.seasonId} = ${seasonId}`
      )
      .orderBy(desc(teamLeagueAssignmentTable.tiktokFollowersAtAssignment));
  }

  /**
   * Crea una nueva temporada
   */
  async createSeason(createSeasonDto: CreateSeasonDto) {
    const db = this.databaseService.db;
    
    const seasonData = {
      ...createSeasonDto,
      startDate: createSeasonDto.startDate ? new Date(createSeasonDto.startDate) : null,
      endDate: createSeasonDto.endDate ? new Date(createSeasonDto.endDate) : null,
    };
    
    const [season] = await db
      .insert(seasonTable)
      .values(seasonData)
      .returning();
    
    return season;
  }

  /**
   * Obtiene todas las temporadas
   */
  async getAllSeasons() {
    const db = this.databaseService.db;
    
    return await db
      .select()
      .from(seasonTable)
      .orderBy(desc(seasonTable.year));
  }

  /**
   * Obtiene la temporada activa
   */
  async getActiveSeason() {
    const db = this.databaseService.db;
    
    const [season] = await db
      .select()
      .from(seasonTable)
      .where(eq(seasonTable.isActive, true))
      .limit(1);
    
    if (!season) {
      throw new NotFoundException('No hay temporada activa');
    }
    
    return season;
  }

  /**
   * Obtiene un resumen de espacios disponibles en todas las ligas para una temporada
   */
  async getLeagueAvailability(seasonId: number) {
    const db = this.databaseService.db;

    const availability = await db
      .select({
        divisionLevel: divisionTable.level,
        divisionName: divisionTable.name,
        leagueId: leagueTable.id,
        leagueName: leagueTable.name,
        groupCode: leagueTable.groupCode,
        maxTeams: leagueTable.maxTeams,
        currentTeams: sql<number>`COUNT(${teamLeagueAssignmentTable.teamId})`.as('currentTeams'),
        availableSlots: sql<number>`${leagueTable.maxTeams} - COUNT(${teamLeagueAssignmentTable.teamId})`.as('availableSlots')
      })
      .from(leagueTable)
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .leftJoin(
        teamLeagueAssignmentTable,
        sql`${leagueTable.id} = ${teamLeagueAssignmentTable.leagueId} AND ${teamLeagueAssignmentTable.seasonId} = ${seasonId}`
      )
      .groupBy(
        divisionTable.level,
        divisionTable.name,
        leagueTable.id,
        leagueTable.name,
        leagueTable.groupCode,
        leagueTable.maxTeams
      )
      .orderBy(asc(divisionTable.level), asc(leagueTable.groupCode));

    return availability;
  }
}
