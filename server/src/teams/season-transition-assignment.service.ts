import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { 
  divisionTable, 
  leagueTable, 
  teamLeagueAssignmentTable,
  teamTable,
  AssignmentReason
} from '../database/schema';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { DATABASE_PROVIDER } from '../database/database.module';

export interface TeamAssignmentPlan {
  teamId: number;
  teamName: string;
  currentDivisionLevel: number;
  targetDivisionLevel: number;
  targetLeagueId: number;
  reason: 'promotion' | 'relegation' | 'playoff_promotion' | 'stays';
  reasonDetails: string;
}

@Injectable()
export class SeasonTransitionAssignmentService {
  private readonly logger = new Logger(SeasonTransitionAssignmentService.name);

  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
  ) {}

  /**
   * Genera un plan de asignaciones para la próxima temporada
   * considerando ascensos, descensos y ganadores de playoffs
   */

  // Método auxiliar para obtener ligas por nivel de división

  async generateNextSeasonAssignmentPlan(
    currentSeasonId: number,
    nextSeasonId: number
  ): Promise<TeamAssignmentPlan[]> {
    const db = this.databaseService.db;
    // 1. Leer todos los equipos y su asignación actual
    const currentAssignments = await db
      .select({
        teamId: teamTable.id,
        teamName: teamTable.name,
        currentLeagueId: teamLeagueAssignmentTable.leagueId,
        divisionId: divisionTable.id,
        divisionLevel: divisionTable.level,
        divisionName: divisionTable.name,
        promotedNextSeason: teamLeagueAssignmentTable.promotedNextSeason,
        relegatedNextSeason: teamLeagueAssignmentTable.relegatedNextSeason
      })
      .from(teamLeagueAssignmentTable)
      .innerJoin(teamTable, eq(teamLeagueAssignmentTable.teamId, teamTable.id))
      .innerJoin(leagueTable, eq(teamLeagueAssignmentTable.leagueId, leagueTable.id))
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .where(eq(teamLeagueAssignmentTable.seasonId, currentSeasonId));

    // 2. Agrupar equipos por tipo de movimiento
    const promotions = currentAssignments.filter(a => a.promotedNextSeason);
    const relegations = currentAssignments.filter(a => a.relegatedNextSeason);
    const stays = currentAssignments.filter(a => !a.promotedNextSeason && !a.relegatedNextSeason);

    // 3. Construir modelo de ligas objetivo
    // Map: divisionLevel -> array de ligas con { id, divisionLevel, currentTeams: [], maxTeams }
    const divisionLevels = [...new Set(currentAssignments.map(a => a.divisionLevel))].sort((a, b) => a - b);
    const leagueModel: Record<number, Array<{ id: number; divisionLevel: number; currentTeams: any[]; maxTeams: number }>> = {};
    for (const level of divisionLevels) {
      const leagues = await db
        .select({ id: leagueTable.id, maxTeams: leagueTable.maxTeams })
        .from(leagueTable)
        .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
        .where(eq(divisionTable.level, level));
      leagueModel[level] = leagues.map(l => ({ id: l.id, divisionLevel: level, currentTeams: [], maxTeams: l.maxTeams }));
    }

    // 4. Asignar equipos a ligas destino
    // a) Ascendidos: van a la división superior
    for (const team of promotions) {
      const targetLevel = team.divisionLevel - 1;
      const targetLeagues = leagueModel[targetLevel];
      if (!targetLeagues) throw new Error(`No hay ligas en división ${targetLevel} para ascender a ${team.teamName}`);
      // Buscar liga con menos equipos
      const sorted = targetLeagues.sort((a, b) => a.currentTeams.length - b.currentTeams.length);
      const liga = sorted.find(l => l.currentTeams.length < l.maxTeams);
      if (!liga) throw new Error(`No hay huecos en división ${targetLevel} para ascender a ${team.teamName}`);
      liga.currentTeams.push({ ...team, reason: 'promotion', reasonDetails: `Asciende desde división ${team.divisionLevel}` });
    }

    // b) Descendidos: van a la división inferior
    for (const team of relegations) {
      const targetLevel = team.divisionLevel + 1;
      const targetLeagues = leagueModel[targetLevel];
      if (!targetLeagues) throw new Error(`No hay ligas en división ${targetLevel} para descender a ${team.teamName}`);
      const sorted = targetLeagues.sort((a, b) => a.currentTeams.length - b.currentTeams.length);
      const liga = sorted.find(l => l.currentTeams.length < l.maxTeams);
      if (!liga) throw new Error(`No hay huecos en división ${targetLevel} para descender a ${team.teamName}`);
      liga.currentTeams.push({ ...team, reason: 'relegation', reasonDetails: `Desciende desde división ${team.divisionLevel}` });
    }

    // c) Permanecen: se quedan en su división
    for (const team of stays) {
      const targetLevel = team.divisionLevel;
      const targetLeagues = leagueModel[targetLevel];
      if (!targetLeagues) throw new Error(`No hay ligas en división ${targetLevel} para permanecer ${team.teamName}`);
      // Buscar liga con menos equipos
      const sorted = targetLeagues.sort((a, b) => a.currentTeams.length - b.currentTeams.length);
      const liga = sorted.find(l => l.currentTeams.length < l.maxTeams);
      if (!liga) throw new Error(`No hay huecos en división ${targetLevel} para permanecer ${team.teamName}`);
      liga.currentTeams.push({ ...team, reason: 'stays', reasonDetails: 'Permanece en la misma división' });
    }

    // 5. Validaciones finales
    // a) Todas las ligas deben tener exactamente maxTeams
    for (const level of divisionLevels) {
      for (const liga of leagueModel[level]) {
        if (liga.currentTeams.length !== liga.maxTeams) {
          throw new Error(`La liga ${liga.id} de división ${level} tiene ${liga.currentTeams.length} equipos (esperado: ${liga.maxTeams})`);
        }
      }
    }
    // b) No equipos duplicados
    const allAssignedIds = Object.values(leagueModel).flat().flatMap(l => l.currentTeams.map(t => t.teamId));
    const uniqueIds = new Set(allAssignedIds);
    if (allAssignedIds.length !== uniqueIds.size) {
      throw new Error('Hay equipos asignados a más de una liga');
    }
    // c) No equipos sin asignar
    if (allAssignedIds.length !== currentAssignments.length) {
      throw new Error('Hay equipos sin asignar a ninguna liga');
    }

    // 6. Construir assignmentPlan final
    const assignmentPlan: TeamAssignmentPlan[] = [];
    for (const level of divisionLevels) {
      for (const liga of leagueModel[level]) {
        for (const team of liga.currentTeams) {
          assignmentPlan.push({
            teamId: team.teamId,
            teamName: team.teamName,
            currentDivisionLevel: team.divisionLevel,
            targetDivisionLevel: level,
            targetLeagueId: liga.id,
            reason: team.reason,
            reasonDetails: team.reasonDetails
          });
        }
      }
    }
    return assignmentPlan;
  }

  // Método auxiliar para obtener ligas por nivel de división
  private async getLeaguesByDivisionLevel(level: number) {
    const db = this.databaseService.db;
    return await db
      .select({ id: leagueTable.id, maxTeams: leagueTable.maxTeams })
      .from(leagueTable)
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .where(eq(divisionTable.level, level));
  }

  /**
   * Ejecuta el plan de asignaciones para la próxima temporada
   */
  async executeAssignmentPlan(
    assignmentPlan: TeamAssignmentPlan[],
    nextSeasonId: number
  ): Promise<{ success: number; errors: string[] }> {
    const db = this.databaseService.db;
    let successCount = 0;
    const errors: string[] = [];

    for (const assignment of assignmentPlan) {
      try {
        // Insertar la asignación directamente
        await db.insert(teamLeagueAssignmentTable).values({
          teamId: assignment.teamId,
          leagueId: assignment.targetLeagueId,
          seasonId: nextSeasonId,
          assignmentReason: this.getAssignmentReason(assignment.reason),
          tiktokFollowersAtAssignment: undefined // Si necesitas followers, deberás obtenerlos antes
        });
        successCount++;
        this.logger.log(`✅ ${assignment.teamName}: ${assignment.reasonDetails}`);
      } catch (error) {
        const errorMsg = `Error asignando equipo ${assignment.teamId}: ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(errorMsg);
      }
    }
    return { success: successCount, errors };
  }


  /**
   * Encuentra la mejor liga para un equipo en una división específica
   * Ahora asigna al grupo con menos equipos actualmente
   */
  private async findBestLeagueForTeam(
    teamId: number,
    divisionLevel: number,
    nextSeasonId: number
  ): Promise<number> {
    const db = this.databaseService.db;

    // Obtener división objetivo
    const [targetDivision] = await db
      .select()
      .from(divisionTable)
      .where(eq(divisionTable.level, divisionLevel));

    if (!targetDivision) {
      throw new Error(`División ${divisionLevel} no encontrada`);
    }

    // Obtener ligas disponibles en la división, ordenadas por cantidad de equipos actual (menos equipos primero)
    const availableLeagues = await db
      .select({
        leagueId: leagueTable.id,
        leagueName: leagueTable.name,
        groupCode: leagueTable.groupCode,
        maxTeams: leagueTable.maxTeams,
        currentTeams: sql<number>`COUNT(${teamLeagueAssignmentTable.teamId})`.as('currentTeams')
      })
      .from(leagueTable)
      .leftJoin(
        teamLeagueAssignmentTable,
        and(
          eq(leagueTable.id, teamLeagueAssignmentTable.leagueId),
          eq(teamLeagueAssignmentTable.seasonId, nextSeasonId)
        )
      )
      .where(eq(leagueTable.divisionId, targetDivision.id))
      .groupBy(leagueTable.id, leagueTable.name, leagueTable.groupCode, leagueTable.maxTeams)
      .having(sql`COUNT(${teamLeagueAssignmentTable.teamId}) < ${leagueTable.maxTeams}`)
      .orderBy(sql`COUNT(${teamLeagueAssignmentTable.teamId})`, asc(leagueTable.groupCode));

    if (availableLeagues.length === 0) {
      throw new Error(`No hay espacios disponibles en División ${divisionLevel}`);
    }

    // Retornar la liga/grupo con menos equipos actualmente
    return availableLeagues[0].leagueId;
  }

  /**
   * Convierte el tipo de razón a AssignmentReason enum
   */
  private getAssignmentReason(reason: TeamAssignmentPlan['reason']): AssignmentReason {
    switch (reason) {
      case 'promotion':
      case 'playoff_promotion':
        return AssignmentReason.PROMOTION;
      case 'relegation':
        return AssignmentReason.RELEGATION;
      default:
        return AssignmentReason.INITIAL_TIKTOK;
    }
  }

  /**
   * Optimiza la distribución de equipos entre grupos de una misma división
   */
  async optimizeGroupDistribution(
    divisionLevel: number,
    nextSeasonId: number
  ): Promise<{ message: string; redistributions: number }> {
    const db = this.databaseService.db;
    
    // Obtener división
    const [division] = await db
      .select()
      .from(divisionTable)
      .where(eq(divisionTable.level, divisionLevel));

    if (!division || division.totalLeagues <= 1) {
      return { message: 'División no requiere optimización', redistributions: 0 };
    }

    // Obtener distribución actual
    const currentDistribution = await db
      .select({
        leagueId: leagueTable.id,
        leagueName: leagueTable.name,
        groupCode: leagueTable.groupCode,
        teamCount: sql<number>`COUNT(${teamLeagueAssignmentTable.teamId})`.as('teamCount')
      })
      .from(leagueTable)
      .leftJoin(
        teamLeagueAssignmentTable,
        and(
          eq(leagueTable.id, teamLeagueAssignmentTable.leagueId),
          eq(teamLeagueAssignmentTable.seasonId, nextSeasonId)
        )
      )
      .where(eq(leagueTable.divisionId, division.id))
      .groupBy(leagueTable.id, leagueTable.name, leagueTable.groupCode)
      .orderBy(asc(leagueTable.groupCode));

    // Verificar si la distribución está balanceada
    const teamCounts = currentDistribution.map(d => Number(d.teamCount));
    const maxDifference = Math.max(...teamCounts) - Math.min(...teamCounts);

    if (maxDifference <= 1) {
      return { message: 'Distribución ya está balanceada', redistributions: 0 };
    }

    // TODO: Implementar lógica de redistribución si es necesario
    // Por ahora retornamos que no se hicieron cambios
    return { message: 'Redistribución no implementada aún', redistributions: 0 };
  }
}
