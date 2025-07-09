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
    const [{ count }] = await db
      .select({ count: sql`count(*)` })
      .from(matchTable)
      .where(eq(matchTable.seasonId, generateDto.seasonId));
      
    if (Number(count) > 0) {
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
    const leagueResults: any[] = [];
    
    for (const league of leaguesWithTeams) {
      const matches = this.generateRoundRobinMatches(
        league.teams,
        league.leagueId,
        generateDto.seasonId,
        startDate,
        generateDto.daysPerMatchday || 7
      );
      
      // Verificar que la generación sea correcta
      const verification = this.verifyRoundRobinGeneration(league.teams, matches);
      
      leagueResults.push({
        leagueId: league.leagueId,
        leagueName: league.leagueName,
        teamsCount: league.teams.length,
        matchesGenerated: matches.length,
        verification: verification
      });
      
      // Solo agregar partidos si la verificación es exitosa
      if (verification.isValid) {
        allMatches.push(...matches);
      } else {
        console.error(`Error en generación de partidos para liga ${league.leagueName}:`, verification.errors);
        throw new BadRequestException(
          `Error en la generación de partidos para la liga "${league.leagueName}": ${verification.errors.join(', ')}`
        );
      }
    }

    // 7. Insertar todos los partidos en la base de datos
    if (allMatches.length > 0) {
      await db.insert(matchTable).values(allMatches);
    }

    return {
      message: 'Partidos generados exitosamente',
      totalMatches: allMatches.length,
      leaguesProcessed: leaguesWithTeams.length,
      startDate: startDate.toISOString().split('T')[0],
      leagueResults: leagueResults
    };
  }

  /**
   * Generar sistema de todos contra todos (ida y vuelta)
   * Usa el algoritmo Round Robin estándar para garantizar distribución correcta
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

    console.log(`Generando partidos para ${teamCount} equipos en liga ${leagueId}`);

    let matchday = 1;
    let currentDate = new Date(startDate);

    // Generar PRIMERA VUELTA usando algoritmo Round Robin estándar
    const firstRoundMatches = this.generateStandardRoundRobin(teams);
    
    console.log(`Primera vuelta: ${firstRoundMatches.length} jornadas generadas`);
    
    for (const roundMatches of firstRoundMatches) {
      for (const match of roundMatches) {
        matches.push({
          seasonId,
          leagueId,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          matchday,
          scheduledDate: currentDate.toISOString().split('T')[0],
          status: MatchStatus.SCHEDULED,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      matchday++;
      currentDate.setDate(currentDate.getDate() + daysPerMatchday);
    }

    // Generar SEGUNDA VUELTA (invertir local y visitante)
    console.log(`Segunda vuelta: ${firstRoundMatches.length} jornadas adicionales`);
    
    for (const roundMatches of firstRoundMatches) {
      for (const match of roundMatches) {
        matches.push({
          seasonId,
          leagueId,
          homeTeamId: match.awayTeamId, // Intercambiar local y visitante
          awayTeamId: match.homeTeamId,
          matchday,
          scheduledDate: currentDate.toISOString().split('T')[0],
          status: MatchStatus.SCHEDULED,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      matchday++;
      currentDate.setDate(currentDate.getDate() + daysPerMatchday);
    }

    console.log(`Total generado: ${matches.length} partidos en ${matchday - 1} jornadas`);
    return matches;
  }

  /**
   * Generar una vuelta completa usando algoritmo Round Robin estándar
   * Retorna un array de jornadas, cada jornada contiene los partidos de esa fecha
   * 
   * El algoritmo Round Robin garantiza que:
   * - Cada equipo juega exactamente una vez contra cada otro equipo
   * - En cada jornada, todos los equipos juegan (excepto si hay número impar)
   * - La distribución de local/visitante es equilibrada
   */
  private generateStandardRoundRobin(teams: any[]): any[][] {
    const teamCount = teams.length;
    
    if (teamCount < 2) {
      return [];
    }
    
    // Algoritmo Round Robin usando el método del "círculo rotativo"
    // Fijar el primer equipo y rotar los demás
    
    let workingTeams = [...teams];
    
    // Si hay número impar, agregar un "bye" (descanso)
    if (teamCount % 2 === 1) {
      workingTeams.push({ id: null, name: 'BYE' });
    }
    
    const totalTeams = workingTeams.length;
    const rounds: any[][] = [];
    const numRounds = totalTeams - 1;
    
    console.log(`Round Robin: ${teamCount} equipos, generando ${numRounds} jornadas`);
    
    for (let round = 0; round < numRounds; round++) {
      const roundMatches: any[] = [];
      
      // En cada jornada, emparejar equipos: 0 vs último, 1 vs penúltimo, etc.
      for (let i = 0; i < totalTeams / 2; i++) {
        const homeTeam = workingTeams[i];
        const awayTeam = workingTeams[totalTeams - 1 - i];
        
        // Solo agregar si ninguno es el "bye"
        if (homeTeam.id !== null && awayTeam.id !== null) {
          roundMatches.push({
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id
          });
        }
      }
      
      rounds.push(roundMatches);
      console.log(`Jornada ${round + 1}: ${roundMatches.length} partidos`);
      
      // Rotar equipos (excepto el primero que permanece fijo)
      // Mover el último equipo a la segunda posición
      const lastTeam = workingTeams.pop();
      workingTeams.splice(1, 0, lastTeam);
    }
    
    return rounds;
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
    
    if (query.divisionId) {
      conditions.push(eq(leagueTable.divisionId, query.divisionId));
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
    
    if (query.isPlayoff !== undefined) {
      conditions.push(eq(matchTable.isPlayoff, query.isPlayoff));
    }
    
    if (query.playoffRound) {
      conditions.push(eq(matchTable.playoffRound, query.playoffRound));
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
        isPlayoff: matchTable.isPlayoff,
        playoffRound: matchTable.playoffRound,
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
      isPlayoff: match.isPlayoff,
      playoffRound: match.playoffRound,
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
    let countQuery;
    
    // Si tenemos filtro por divisionId, necesitamos hacer JOIN con leagueTable
    if (query.divisionId) {
      countQuery = db
        .select({ count: sql`count(*)` })
        .from(matchTable)
        .innerJoin(leagueTable, eq(matchTable.leagueId, leagueTable.id));
    } else {
      countQuery = db
        .select({ count: sql`count(*)` })
        .from(matchTable);
    }
    
    const [{ count }] = await countQuery
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

  /**
   * Verificar que todos los cruces posibles se hayan generado correctamente
   * Útil para testing y debugging
   */
  private verifyRoundRobinGeneration(teams: any[], matches: any[]): { 
    isValid: boolean; 
    errors: string[];
    stats: {
      expectedMatches: number;
      actualMatches: number;
      expectedMatchesPerTeam: number;
      teamsStats: { teamId: number; homeMatches: number; awayMatches: number; totalMatches: number }[];
    }
  } {
    const teamCount = teams.length;
    const errors: string[] = [];
    
    // Estadísticas esperadas
    const expectedTotalMatches = teamCount * (teamCount - 1); // ida y vuelta
    const expectedMatchesPerTeam = (teamCount - 1) * 2; // contra cada otro equipo, ida y vuelta
    
    // Crear mapa de estadísticas por equipo
    const teamStats = new Map();
    teams.forEach(team => {
      teamStats.set(team.id, {
        teamId: team.id,
        homeMatches: 0,
        awayMatches: 0,
        totalMatches: 0,
        opponents: new Set()
      });
    });
    
    // Analizar partidos generados
    matches.forEach(match => {
      const homeTeamStats = teamStats.get(match.homeTeamId);
      const awayTeamStats = teamStats.get(match.awayTeamId);
      
      if (homeTeamStats) {
        homeTeamStats.homeMatches++;
        homeTeamStats.totalMatches++;
        homeTeamStats.opponents.add(match.awayTeamId);
      }
      
      if (awayTeamStats) {
        awayTeamStats.awayMatches++;
        awayTeamStats.totalMatches++;
        awayTeamStats.opponents.add(match.homeTeamId);
      }
    });
    
    // Verificar estadísticas
    if (matches.length !== expectedTotalMatches) {
      errors.push(`Número total de partidos incorrecto: esperados ${expectedTotalMatches}, generados ${matches.length}`);
    }
    
    // Verificar cada equipo
    teamStats.forEach(stats => {
      if (stats.totalMatches !== expectedMatchesPerTeam) {
        errors.push(`Equipo ${stats.teamId}: esperados ${expectedMatchesPerTeam} partidos, tiene ${stats.totalMatches}`);
      }
      
      if (stats.homeMatches !== teamCount - 1) {
        errors.push(`Equipo ${stats.teamId}: esperados ${teamCount - 1} partidos de local, tiene ${stats.homeMatches}`);
      }
      
      if (stats.awayMatches !== teamCount - 1) {
        errors.push(`Equipo ${stats.teamId}: esperados ${teamCount - 1} partidos de visitante, tiene ${stats.awayMatches}`);
      }
      
      if (stats.opponents.size !== teamCount - 1) {
        errors.push(`Equipo ${stats.teamId}: debe jugar contra ${teamCount - 1} oponentes diferentes, pero juega contra ${stats.opponents.size}`);
      }
    });
    
    // Verificar que no hay partidos duplicados
    const matchPairs = new Set();
    const duplicates: string[] = [];
    
    matches.forEach(match => {
      const pairKey = `${match.homeTeamId}-${match.awayTeamId}`;
      if (matchPairs.has(pairKey)) {
        duplicates.push(pairKey);
      }
      matchPairs.add(pairKey);
    });
    
    if (duplicates.length > 0) {
      errors.push(`Partidos duplicados encontrados: ${duplicates.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      stats: {
        expectedMatches: expectedTotalMatches,
        actualMatches: matches.length,
        expectedMatchesPerTeam,
        teamsStats: Array.from(teamStats.values()).map(stats => ({
          teamId: stats.teamId,
          homeMatches: stats.homeMatches,
          awayMatches: stats.awayMatches,
          totalMatches: stats.totalMatches
        }))
      }
    };
  }
}
