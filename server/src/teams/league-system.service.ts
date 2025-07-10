import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { 
  divisionTable, 
  leagueTable, 
  seasonTable, 
  teamLeagueAssignmentTable,
  teamTable,
  matchTable,
  standingsTable,
  AssignmentReason
} from '../database/schema';
import { eq, desc, asc, sql } from 'drizzle-orm';
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
   * Verifica si el sistema de ligas ya está inicializado
   */
  async isSystemInitialized(): Promise<boolean> {
    const db = this.databaseService.db;
    
    const divisionCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(divisionTable);
    
    return divisionCount[0].count > 0;
  }

  /**
   * Verifica si hay asignaciones existentes para una temporada
   */
  async hasExistingAssignments(seasonId?: number): Promise<boolean> {
    const db = this.databaseService.db;
    
    if (seasonId) {
      const assignmentCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(teamLeagueAssignmentTable)
        .where(eq(teamLeagueAssignmentTable.seasonId, seasonId));
      
      return assignmentCount[0].count > 0;
    } else {
      const assignmentCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(teamLeagueAssignmentTable);
      
      return assignmentCount[0].count > 0;
    }
  }

  /**
   * Resetea el sistema de ligas para la temporada activa (solo elimina standings, matches y team league assignments)
   */
  async resetLeagueSystem(): Promise<{ message: string; warning: string }> {
    const db = this.databaseService.db;
    
    try {
      // Obtener la temporada activa
      let activeSeason;
      try {
        activeSeason = await this.getActiveSeason();
      } catch (error) {
        return {
          message: 'No se pudo realizar el reset',
          warning: 'No hay temporada activa. Para realizar un reset, debe existir una temporada activa.'
        };
      }
      
      console.log(`Reseteando datos para la temporada activa (ID: ${activeSeason.id})`);
      
      // Eliminar en orden correcto por las claves foráneas
      // Primero las tablas que dependen de matches para la temporada activa
      const deletedStandings = await db.delete(standingsTable)
        .where(eq(standingsTable.seasonId, activeSeason.id));
      
      // Luego los partidos de la temporada activa
      const deletedMatches = await db.delete(matchTable)
        .where(eq(matchTable.seasonId, activeSeason.id));
      
      // Después las asignaciones de la temporada activa
      const deletedAssignments = await db.delete(teamLeagueAssignmentTable)
        .where(eq(teamLeagueAssignmentTable.seasonId, activeSeason.id));
      
      // Mantenemos las ligas y divisiones, solo eliminamos los datos específicos de la temporada
      
      console.log('Reset de la temporada activa ejecutado:', { 
        temporadaId: activeSeason.id,
        temporadaNombre: activeSeason.name,
        deletedStandings, 
        deletedMatches, 
        deletedAssignments
      });
      
      return { 
        message: `Temporada ${activeSeason.name} reseteada correctamente`,
        warning: 'Se han eliminado clasificaciones, partidos y asignaciones de equipos para la temporada activa. Las ligas, divisiones y equipos se han mantenido intactos.'
      };
    } catch (error) {
      console.error('Error en resetLeagueSystem:', error);
      throw error;
    }
  }

  /**
   * Resetea solo las asignaciones de una temporada específica
   */
  async resetSeasonAssignments(seasonId: number): Promise<{ message: string; deletedAssignments: number }> {
    const db = this.databaseService.db;
    
    try {
      // Contar asignaciones antes de borrar
      const countBefore = await db
        .select({ count: sql<number>`count(*)` })
        .from(teamLeagueAssignmentTable)
        .where(eq(teamLeagueAssignmentTable.seasonId, seasonId));
      
      // Eliminar clasificaciones de esta temporada
      await db.delete(standingsTable)
        .where(eq(standingsTable.seasonId, seasonId));
      
      // Eliminar partidos de esta temporada
      await db.delete(matchTable)
        .where(eq(matchTable.seasonId, seasonId));
      
      // Eliminar las asignaciones de esta temporada
      await db.delete(teamLeagueAssignmentTable)
        .where(eq(teamLeagueAssignmentTable.seasonId, seasonId));
      
      const deletedCount = countBefore[0].count;
      
      return {
        message: `Temporada ${seasonId} reseteada: asignaciones, partidos y clasificaciones eliminados`,
        deletedAssignments: deletedCount
      };
    } catch (error) {
      console.error('Error en resetSeasonAssignments:', error);
      throw error;
    }
  }

  /**
   * Inicializa la estructura completa de divisiones y ligas según las especificaciones
   * Ahora es idempotente y preserva datos existentes
   * @param runSeed Si es true, también ejecuta el seed de datos iniciales
   */
  async initializeLeagueSystem(runSeed: boolean = false): Promise<{ 
    message: string; 
    isNewSystem: boolean; 
    existingAssignments?: number;
    seedResult?: string;
    assignmentResult?: {
      message: string;
      assignedTeams: number;
      skippedTeams: number;
      totalTeams: number;
      wasAlreadyAssigned: boolean;
    };
  }> {
    const db = this.databaseService.db;
    
    // Verificar si el sistema ya está inicializado
    const systemExists = await this.isSystemInitialized();
    const existingAssignmentsCount = systemExists ? 
      (await db.select({ count: sql<number>`count(*)` }).from(teamLeagueAssignmentTable))[0].count : 0;
    
    if (systemExists) {
      console.log(`Sistema ya inicializado. Asignaciones existentes: ${existingAssignmentsCount}`);
    }
    
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
        tournamentSlots: 8 // Top 8 van a torneos
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
        tournamentSlots: 0
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
        tournamentSlots: 0
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
        tournamentSlots: 0
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
        tournamentSlots: 0
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

        const leagueData = {
          name: leagueName,
          groupCode: groupCode,
          divisionId: division.id,
          maxTeams: divisionConfig.teamsPerLeague,
          description: `Grupo ${groupCode} de ${divisionConfig.name}`
        };

        await db
          .insert(leagueTable)
          .values(leagueData)
          .onConflictDoUpdate({
            target: [leagueTable.divisionId, leagueTable.groupCode],
            set: {
              name: leagueData.name,
              maxTeams: leagueData.maxTeams,
              description: leagueData.description
            }
          });
      }
    }

    const finalExistingAssignments = (await db.select({ count: sql<number>`count(*)` }).from(teamLeagueAssignmentTable))[0].count;

    // Si se solicita ejecutar el seed
    let seedResult: string | undefined;
    if (runSeed) {
      console.log('Iniciando ejecución del seed por solicitud explícita');
      try {
        // Importamos y ejecutamos el script de seed
        console.log('Intentando importar el módulo de seed');
        const seedModule = await import('../database/seed');
        console.log('Módulo seed importado:', Object.keys(seedModule));
        
        if (typeof seedModule.seed === 'function') {
          console.log('Función seed encontrada, ejecutando...');
          try {
            // Pasamos la conexión existente a la base de datos
            await seedModule.seed(this.databaseService.db);
            seedResult = 'Seed ejecutado correctamente';
            console.log('Seed completado exitosamente desde initializeLeagueSystem');
          } catch (seedError) {
            console.error('Error durante la ejecución de seed():', seedError);
            seedResult = `Error durante la ejecución: ${seedError.message}`;
          }
        } else {
          console.error('La función seed no se encontró en el módulo importado');
          seedResult = 'Error: La función seed no se encontró en el módulo';
        }
      } catch (error) {
        console.error('Error ejecutando seed:', error);
        seedResult = `Error ejecutando seed: ${error.message}`;
      }
    } else {
      console.log('No se solicitó ejecutar el seed (runSeed=false)');
    }

    // Asignar equipos a ligas en la temporada activa
    let assignmentResult;
    try {
      // Obtener la temporada activa
      const activeSeason = await this.getActiveSeason();
      console.log(`Asignando equipos a ligas en la temporada activa (ID: ${activeSeason.id})`);
      
      // Asignar todos los equipos a ligas basados en seguidores de TikTok
      assignmentResult = await this.assignTeamsToLeaguesByTikTokFollowers(activeSeason.id);
      console.log('Resultado de la asignación:', assignmentResult);
    } catch (error) {
      console.error('Error al asignar equipos a ligas:', error);
      // Si hay un error en la asignación, continuamos pero registramos el error
      assignmentResult = {
        message: `Error al asignar equipos: ${error.message}`,
        assignedTeams: 0,
        skippedTeams: 0,
        totalTeams: 0,
        wasAlreadyAssigned: false
      };
    }

    return { 
      message: systemExists ? 
        'Sistema de ligas ya estaba inicializado - estructura verificada' : 
        'Sistema de ligas inicializado correctamente',
      isNewSystem: !systemExists,
      existingAssignments: finalExistingAssignments,
      seedResult,
      assignmentResult
    };
  }

  /**
   * Asigna equipos a ligas basándose en sus seguidores de TikTok
   * Es idempotente: solo asigna equipos que no estén ya asignados
   */
  async assignTeamsToLeaguesByTikTokFollowers(seasonId: number): Promise<{
    message: string;
    assignedTeams: number;
    skippedTeams: number;
    totalTeams: number;
    wasAlreadyAssigned: boolean;
  }> {
    const db = this.databaseService.db;

    // Verificar si ya hay asignaciones para esta temporada
    const existingAssignments = await this.hasExistingAssignments(seasonId);
    
    if (existingAssignments) {
      const existingCount = (await db
        .select({ count: sql<number>`count(*)` })
        .from(teamLeagueAssignmentTable)
        .where(eq(teamLeagueAssignmentTable.seasonId, seasonId)))[0].count;
      
      console.log(`Ya existen ${existingCount} asignaciones para la temporada ${seasonId}`);
    }

    // Obtener equipos que NO están asignados en esta temporada
    const teamsAlreadyAssigned = await db
      .select({ teamId: teamLeagueAssignmentTable.teamId })
      .from(teamLeagueAssignmentTable)
      .where(eq(teamLeagueAssignmentTable.seasonId, seasonId));

    const assignedTeamIds = teamsAlreadyAssigned.map(a => a.teamId);

    // Obtener todos los equipos no asignados, ordenados por seguidores de TikTok (descendente)
    const availableTeams = await db
      .select()
      .from(teamTable)
      .where(
        assignedTeamIds.length > 0 
          ? sql`${teamTable.id} NOT IN (${assignedTeamIds.join(',')})`
          : sql`1=1` // Sin filtro si no hay equipos asignados
      )
      .orderBy(desc(teamTable.followers));

    if (availableTeams.length === 0) {
      const totalTeams = (await db.select({ count: sql<number>`count(*)` }).from(teamTable))[0].count;
      return {
        message: 'Todos los equipos ya están asignados a ligas en esta temporada',
        assignedTeams: 0,
        skippedTeams: assignedTeamIds.length,
        totalTeams,
        wasAlreadyAssigned: true
      };
    }

    // Obtener ligas con espacios disponibles
    const leaguesWithSpace = await this.getLeaguesWithAvailableSpace(seasonId);

    if (leaguesWithSpace.length === 0) {
      throw new BadRequestException('No hay espacios disponibles en ninguna liga');
    }

    // Asignar equipos disponibles a espacios disponibles
    const assignments: any[] = [];
    let teamIndex = 0;

    for (const league of leaguesWithSpace) {
      const availableSpaces = league.maxTeams - league.currentTeams;
      
      for (let i = 0; i < availableSpaces && teamIndex < availableTeams.length; i++) {
        const team = availableTeams[teamIndex];
        
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

    // Insertar nuevas asignaciones
    if (assignments.length > 0) {
      await db.insert(teamLeagueAssignmentTable).values(assignments);
    }

    const totalTeams = (await db.select({ count: sql<number>`count(*)` }).from(teamTable))[0].count;

    return {
      message: assignments.length > 0 ? 
        `${assignments.length} equipos nuevos asignados a ligas` :
        'No hay equipos nuevos para asignar',
      assignedTeams: assignments.length,
      skippedTeams: assignedTeamIds.length,
      totalTeams,
      wasAlreadyAssigned: existingAssignments
    };
  }

  /**
   * Obtiene ligas con espacios disponibles, ordenadas por prioridad
   */
  private async getLeaguesWithAvailableSpace(seasonId: number) {
    const db = this.databaseService.db;

    // Subconsulta para contar equipos actuales por liga
    const currentTeamCounts = db
      .select({
        leagueId: teamLeagueAssignmentTable.leagueId,
        currentTeams: sql<number>`count(*)`.as('currentTeams')
      })
      .from(teamLeagueAssignmentTable)
      .where(eq(teamLeagueAssignmentTable.seasonId, seasonId))
      .groupBy(teamLeagueAssignmentTable.leagueId)
      .as('currentCounts');

    // Obtener ligas con información de espacios disponibles
    const leagues = await db
      .select({
        id: leagueTable.id,
        name: leagueTable.name,
        groupCode: leagueTable.groupCode,
        maxTeams: leagueTable.maxTeams,
        divisionId: leagueTable.divisionId,
        divisionLevel: divisionTable.level,
        currentTeams: sql<number>`COALESCE(${currentTeamCounts.currentTeams}, 0)`.as('currentTeams')
      })
      .from(leagueTable)
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .leftJoin(currentTeamCounts, eq(leagueTable.id, currentTeamCounts.leagueId))
      .orderBy(asc(divisionTable.level), asc(leagueTable.groupCode));

    // Filtrar solo ligas con espacios disponibles
    return leagues.filter(league => league.currentTeams < league.maxTeams);
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
        tournamentSlots: divisionTable.tournamentSlots,
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
          tournamentSlots: row.tournamentSlots,
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

    // Comprobar si ya existe una temporada activa
    const [activeSeason] = await db
      .select()
      .from(seasonTable)
      .where(eq(seasonTable.isActive, true))
      .limit(1);
    if (activeSeason) {
      throw new BadRequestException({
        message: 'No se puede crear una nueva temporada porque ya existe una temporada activa.',
        userMessage: 'Ya hay una temporada en curso. Debes finalizar la temporada actual antes de poder crear una nueva.',
        code: 'SEASON_ACTIVE_EXISTS'
      });
    }

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
