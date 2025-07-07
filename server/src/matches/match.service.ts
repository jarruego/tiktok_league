import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { 
  matchTable, 
  seasonTable, 
  leagueTable, 
  teamLeagueAssignmentTable, 
  teamTable, 
  divisionTable,
  MatchStatus 
} from '../database/schema';
import { eq, and, desc, asc, gte, lte, or, sql } from 'drizzle-orm';
import { CreateMatchDto, GenerateMatchesDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { GetMatchesQueryDto } from './dto/get-matches-query.dto';
import { DATABASE_PROVIDER } from '../database/database.module';

@Injectable()
export class MatchService {
  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Crear un partido individual
   */
  async create(createMatchDto: CreateMatchDto) {
    const db = this.databaseService.db;
    
    // Validar que los equipos existan y pertenezcan a la liga
    await this.validateTeamsInLeague(createMatchDto.homeTeamId, createMatchDto.awayTeamId, createMatchDto.leagueId, createMatchDto.seasonId);
    
    const [match] = await db.insert(matchTable).values({
      ...createMatchDto,
      status: MatchStatus.SCHEDULED
    }).returning();
    
    return match;
  }

  /**
   * Generar todos los partidos para una temporada
   */
  async generateMatches(generateDto: GenerateMatchesDto) {
    const db = this.databaseService.db;
    
    // 1. Obtener la temporada
    const [season] = await db
      .select()
      .from(seasonTable)
      .where(eq(seasonTable.id, generateDto.seasonId));
      
    if (!season) {
      throw new NotFoundException('Temporada no encontrada');
    }

    // 2. Verificar que la temporada esté activa
    if (!season.isActive) {
      throw new BadRequestException('Solo se pueden generar partidos para la temporada activa');
    }

    // 3. Verificar si ya existen partidos para esta temporada
    const existingMatches = await db
      .select({ count: matchTable.id })
      .from(matchTable)
      .where(eq(matchTable.seasonId, generateDto.seasonId));
      
    if (existingMatches.length > 0) {
      throw new BadRequestException('Ya existen partidos generados para esta temporada');
    }

    // 4. Obtener todas las ligas con sus equipos asignados
    const leaguesWithTeams = await this.getLeaguesWithAssignedTeams(generateDto.seasonId);
    
    if (leaguesWithTeams.length === 0) {
      throw new BadRequestException('No hay equipos asignados a ninguna liga en esta temporada');
    }

    // 5. Calcular fecha de inicio
    const startDate = generateDto.startDate 
      ? new Date(generateDto.startDate) 
      : season.startDate 
        ? new Date(season.startDate) 
        : new Date();

    // 6. Generar partidos para cada liga
    const allMatches: any[] = [];
    for (const league of leaguesWithTeams) {
      const matches = this.generateRoundRobinMatches(
        league.teams,
        league.leagueId,
        generateDto.seasonId,
        startDate,
        generateDto.daysPerMatchday || 7
      );
      allMatches.push(...matches);
    }

    // 7. Insertar todos los partidos en la base de datos
    if (allMatches.length > 0) {
      await db.insert(matchTable).values(allMatches);
    }

    return {
      message: 'Partidos generados exitosamente',
      totalMatches: allMatches.length,
      leaguesProcessed: leaguesWithTeams.length,
      startDate: startDate.toISOString().split('T')[0]
    };
  }

  /**
   * Generar sistema de todos contra todos (ida y vuelta)
   */
  private generateRoundRobinMatches(
    teams: any[],
    leagueId: number,
    seasonId: number,
    startDate: Date,
    daysPerMatchday: number
  ) {
    const matches: any[] = [];
    const teamCount = teams.length;
    
    if (teamCount < 2) {
      return matches; // No se pueden generar partidos con menos de 2 equipos
    }

    let matchday = 1;
    let currentDate = new Date(startDate);

    // PRIMERA VUELTA (todos contra todos)
    for (let round = 0; round < teamCount - 1; round++) {
      const roundMatches: any[] = [];
      
      for (let match = 0; match < Math.floor(teamCount / 2); match++) {
        const home = (round + match) % (teamCount - 1);
        const away = (teamCount - 1 - match + round) % (teamCount - 1);
        
        // Si es par, el último equipo es siempre local en rounds pares
        const homeTeam = match === 0 && round % 2 === 1 
          ? teams[teamCount - 1] 
          : teams[home === teamCount - 1 ? away : home];
          
        const awayTeam = match === 0 && round % 2 === 1
          ? teams[away === teamCount - 1 ? home : away]
          : teams[away === teamCount - 1 ? teamCount - 1 : away];

        if (homeTeam.id !== awayTeam.id) {
          roundMatches.push({
            seasonId,
            leagueId,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            matchday,
            scheduledDate: currentDate.toISOString().split('T')[0],
            status: MatchStatus.SCHEDULED,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      }
      
      matches.push(...roundMatches);
      matchday++;
      currentDate.setDate(currentDate.getDate() + daysPerMatchday);
    }

    // SEGUNDA VUELTA (partidos de vuelta)
    const firstRoundMatches = [...matches];
    for (const firstMatch of firstRoundMatches) {
      matches.push({
        seasonId: firstMatch.seasonId,
        leagueId: firstMatch.leagueId,
        homeTeamId: firstMatch.awayTeamId, // Intercambiar local y visitante
        awayTeamId: firstMatch.homeTeamId,
        matchday,
        scheduledDate: currentDate.toISOString().split('T')[0],
        status: MatchStatus.SCHEDULED,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Avanzar fecha cada pocos partidos para distribuir las jornadas
      if (matches.length % Math.floor(teamCount / 2) === 0) {
        matchday++;
        currentDate.setDate(currentDate.getDate() + daysPerMatchday);
      }
    }

    return matches;
  }

  /**
   * Obtener ligas con equipos asignados para una temporada
   */
  private async getLeaguesWithAssignedTeams(seasonId: number) {
    const db = this.databaseService.db;
    
    const result = await db
      .select({
        leagueId: leagueTable.id,
        leagueName: leagueTable.name,
        divisionName: divisionTable.name,
        divisionLevel: divisionTable.level,
        teamId: teamTable.id,
        teamName: teamTable.name
      })
      .from(teamLeagueAssignmentTable)
      .innerJoin(leagueTable, eq(teamLeagueAssignmentTable.leagueId, leagueTable.id))
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .innerJoin(teamTable, eq(teamLeagueAssignmentTable.teamId, teamTable.id))
      .where(eq(teamLeagueAssignmentTable.seasonId, seasonId))
      .orderBy(asc(divisionTable.level), asc(leagueTable.name));

    // Agrupar por liga
    const leaguesMap = new Map();
    
    for (const row of result) {
      if (!leaguesMap.has(row.leagueId)) {
        leaguesMap.set(row.leagueId, {
          leagueId: row.leagueId,
          leagueName: row.leagueName,
          divisionName: row.divisionName,
          divisionLevel: row.divisionLevel,
          teams: []
        });
      }
      
      leaguesMap.get(row.leagueId).teams.push({
        id: row.teamId,
        name: row.teamName
      });
    }

    return Array.from(leaguesMap.values());
  }

  /**
   * Validar que los equipos pertenezcan a la liga en la temporada especificada
   */
  private async validateTeamsInLeague(homeTeamId: number, awayTeamId: number, leagueId: number, seasonId: number) {
    const db = this.databaseService.db;
    
    const assignments = await db
      .select()
      .from(teamLeagueAssignmentTable)
      .where(
        and(
          eq(teamLeagueAssignmentTable.seasonId, seasonId),
          eq(teamLeagueAssignmentTable.leagueId, leagueId),
          or(
            eq(teamLeagueAssignmentTable.teamId, homeTeamId),
            eq(teamLeagueAssignmentTable.teamId, awayTeamId)
          )
        )
      );

    if (assignments.length !== 2) {
      throw new BadRequestException('Uno o ambos equipos no pertenecen a la liga especificada');
    }
  }

  /**
   * Obtener partidos con filtros
   */
  async findMany(query: GetMatchesQueryDto) {
    const db = this.databaseService.db;
    
    // Construir condiciones WHERE dinámicamente
    const conditions: any[] = [];
    
    if (query.seasonId) {
      conditions.push(eq(matchTable.seasonId, query.seasonId));
    }
    
    if (query.leagueId) {
      conditions.push(eq(matchTable.leagueId, query.leagueId));
    }
    
    if (query.teamId) {
      conditions.push(
        or(
          eq(matchTable.homeTeamId, query.teamId),
          eq(matchTable.awayTeamId, query.teamId)
        )
      );
    }
    
    if (query.matchday) {
      conditions.push(eq(matchTable.matchday, query.matchday));
    }
    
    if (query.status) {
      conditions.push(eq(matchTable.status, query.status));
    }
    
    if (query.fromDate) {
      conditions.push(gte(matchTable.scheduledDate, query.fromDate));
    }
    
    if (query.toDate) {
      conditions.push(lte(matchTable.scheduledDate, query.toDate));
    }

    // Calcular offset para paginación
    const offset = ((query.page || 1) - 1) * (query.limit || 50);

    const matches = await db
      .select({
        id: matchTable.id,
        matchday: matchTable.matchday,
        scheduledDate: matchTable.scheduledDate,
        status: matchTable.status,
        homeGoals: matchTable.homeGoals,
        awayGoals: matchTable.awayGoals,
        notes: matchTable.notes,
        // Información del equipo local
        homeTeamId: teamTable.id,
        homeTeamName: teamTable.name,
        homeTeamShortName: teamTable.shortName,
        homeTeamCrest: teamTable.crest,
        // Información del equipo visitante será obtenida posteriormente
        awayTeamId: matchTable.awayTeamId,
        // Información de liga
        leagueId: leagueTable.id,
        leagueName: leagueTable.name,
        leagueGroupCode: leagueTable.groupCode,
        // Información de división
        divisionId: divisionTable.id,
        divisionName: divisionTable.name,
        divisionLevel: divisionTable.level
      })
      .from(matchTable)
      .innerJoin(teamTable, eq(matchTable.homeTeamId, teamTable.id))
      .innerJoin(leagueTable, eq(matchTable.leagueId, leagueTable.id))
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(matchTable.scheduledDate), asc(matchTable.matchday))
      .limit(query.limit || 50)
      .offset(offset);

    // Obtener información de los equipos visitantes
    const awayTeamIds = [...new Set(matches.map(m => m.awayTeamId))];
    const awayTeams = awayTeamIds.length > 0 ? await db
      .select({
        id: teamTable.id,
        name: teamTable.name,
        shortName: teamTable.shortName,
        crest: teamTable.crest
      })
      .from(teamTable)
      .where(or(...awayTeamIds.map(id => eq(teamTable.id, id)))) : [];

    const awayTeamsMap = new Map(awayTeams.map(t => [t.id, t]));

    // Formatear los datos para la respuesta
    const formattedMatches = matches.map(match => ({
      id: match.id,
      matchday: match.matchday,
      scheduledDate: match.scheduledDate,
      status: match.status,
      homeGoals: match.homeGoals,
      awayGoals: match.awayGoals,
      notes: match.notes,
      homeTeam: {
        id: match.homeTeamId,
        name: match.homeTeamName,
        shortName: match.homeTeamShortName,
        crest: match.homeTeamCrest
      },
      awayTeam: awayTeamsMap.get(match.awayTeamId) || {
        id: match.awayTeamId,
        name: 'Unknown',
        shortName: null,
        crest: null
      },
      league: {
        id: match.leagueId,
        name: match.leagueName,
        groupCode: match.leagueGroupCode
      },
      division: {
        id: match.divisionId,
        name: match.divisionName,
        level: match.divisionLevel
      }
    }));

    // Contar total para paginación
    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(matchTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      matches: formattedMatches,
      pagination: {
        page: query.page || 1,
        limit: query.limit || 50,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / (query.limit || 50))
      }
    };
  }

  /**
   * Obtener un partido por ID
   */
  async findOne(id: number) {
    const db = this.databaseService.db;
    
    const [match] = await db
      .select()
      .from(matchTable)
      .where(eq(matchTable.id, id));
      
    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }
    
    return match;
  }

  /**
   * Actualizar un partido
   */
  async update(id: number, updateMatchDto: UpdateMatchDto) {
    const db = this.databaseService.db;
    
    const [match] = await db
      .update(matchTable)
      .set({ ...updateMatchDto, updatedAt: new Date() })
      .where(eq(matchTable.id, id))
      .returning();
      
    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }
    
    return match;
  }

  /**
   * Eliminar un partido
   */
  async remove(id: number) {
    const db = this.databaseService.db;
    
    const [match] = await db
      .delete(matchTable)
      .where(eq(matchTable.id, id))
      .returning();
      
    if (!match) {
      throw new NotFoundException('Partido no encontrado');
    }
    
    return match;
  }

  /**
   * Eliminar todos los partidos de una temporada
   */
  async removeAllBySeason(seasonId: number) {
    const db = this.databaseService.db;
    
    const deletedMatches = await db
      .delete(matchTable)
      .where(eq(matchTable.seasonId, seasonId))
      .returning();
      
    return {
      message: 'Partidos eliminados exitosamente',
      deletedCount: deletedMatches.length
    };
  }
}
