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
  async generateNextSeasonAssignmentPlan(
    currentSeasonId: number,
    nextSeasonId: number
  ): Promise<TeamAssignmentPlan[]> {
    const db = this.databaseService.db;
    const assignmentPlan: TeamAssignmentPlan[] = [];

    // Obtener todas las asignaciones actuales
    const currentAssignments = await db
      .select({
        teamId: teamTable.id,
        teamName: teamTable.name,
        currentLeagueId: teamLeagueAssignmentTable.leagueId,
        divisionId: divisionTable.id,
        divisionLevel: divisionTable.level,
        divisionName: divisionTable.name,
        promotedNextSeason: teamLeagueAssignmentTable.promotedNextSeason,
        relegatedNextSeason: teamLeagueAssignmentTable.relegatedNextSeason,
        playoffNextSeason: teamLeagueAssignmentTable.playoffNextSeason,
        qualifiedForTournament: teamLeagueAssignmentTable.qualifiedForTournament
      })
      .from(teamLeagueAssignmentTable)
      .innerJoin(teamTable, eq(teamLeagueAssignmentTable.teamId, teamTable.id))
      .innerJoin(leagueTable, eq(teamLeagueAssignmentTable.leagueId, leagueTable.id))
      .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
      .where(eq(teamLeagueAssignmentTable.seasonId, currentSeasonId))
      .orderBy(asc(divisionTable.level), desc(teamTable.followers));

    // Procesar cada equipo según su estado
    for (const assignment of currentAssignments) {
      let targetDivisionLevel = assignment.divisionLevel;
      let reason: TeamAssignmentPlan['reason'] = 'stays';
      let reasonDetails = 'Permanece en la misma división';

      // Determinar movimiento basado en flags
      if (assignment.promotedNextSeason) {
        targetDivisionLevel = Math.max(1, assignment.divisionLevel - 1);
        reason = 'promotion';
        reasonDetails = `Asciende por méritos deportivos desde División ${assignment.divisionLevel}`;
      } else if (assignment.relegatedNextSeason) {
        targetDivisionLevel = Math.min(5, assignment.divisionLevel + 1);
        reason = 'relegation';
        reasonDetails = `Desciende por méritos deportivos desde División ${assignment.divisionLevel}`;
      } else if (assignment.playoffNextSeason) {
        // Verificar si ganó el playoff (esto se determinaría por los resultados de los partidos)
        const wonPlayoff = await this.checkIfTeamWonPlayoff(assignment.teamId, currentSeasonId);
        if (wonPlayoff) {
          targetDivisionLevel = Math.max(1, assignment.divisionLevel - 1);
          reason = 'playoff_promotion';
          reasonDetails = `Asciende por ganar playoff desde División ${assignment.divisionLevel}`;
        } else {
          reasonDetails = `Permanece tras perder/no completar playoff en División ${assignment.divisionLevel}`;
        }
      }

      // Encontrar liga apropiada en la división objetivo
      const targetLeagueId = await this.findBestLeagueForTeam(
        assignment.teamId,
        targetDivisionLevel,
        nextSeasonId
      );

      assignmentPlan.push({
        teamId: assignment.teamId,
        teamName: assignment.teamName,
        currentDivisionLevel: assignment.divisionLevel,
        targetDivisionLevel,
        targetLeagueId,
        reason,
        reasonDetails
      });
    }

    // Ordenar por prioridad: ascensos primero, luego equipos que se quedan, luego descensos
    assignmentPlan.sort((a, b) => {
      const priorityOrder = { 'promotion': 1, 'playoff_promotion': 2, 'stays': 3, 'relegation': 4 };
      const aPriority = priorityOrder[a.reason];
      const bPriority = priorityOrder[b.reason];
      
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      // Si tienen la misma prioridad, ordenar por división objetivo (superior primero)
      return a.targetDivisionLevel - b.targetDivisionLevel;
    });

    return assignmentPlan;
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
        // Obtener información del equipo
        const [team] = await db
          .select()
          .from(teamTable)
          .where(eq(teamTable.id, assignment.teamId));

        if (!team) {
          errors.push(`Equipo no encontrado: ${assignment.teamId}`);
          continue;
        }

        // Verificar que no existe ya una asignación
        const [existingAssignment] = await db
          .select()
          .from(teamLeagueAssignmentTable)
          .where(
            and(
              eq(teamLeagueAssignmentTable.teamId, assignment.teamId),
              eq(teamLeagueAssignmentTable.seasonId, nextSeasonId)
            )
          );

        if (existingAssignment) {
          this.logger.warn(`Asignación ya existe para equipo ${team.name} en temporada ${nextSeasonId}`);
          continue;
        }

        // Crear nueva asignación
        const assignmentReason = this.getAssignmentReason(assignment.reason);
        
        await db
          .insert(teamLeagueAssignmentTable)
          .values({
            teamId: assignment.teamId,
            leagueId: assignment.targetLeagueId,
            seasonId: nextSeasonId,
            tiktokFollowersAtAssignment: team.followers,
            assignmentReason
          });

        successCount++;
        this.logger.log(`✅ ${team.name}: ${assignment.reasonDetails}`);

      } catch (error) {
        const errorMsg = `Error asignando equipo ${assignment.teamId}: ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(errorMsg);
      }
    }

    return { success: successCount, errors };
  }

  /**
   * Verifica si un equipo ganó su playoff
   */
  private async checkIfTeamWonPlayoff(teamId: number, seasonId: number): Promise<boolean> {
    // Esta función requiere lógica más compleja para determinar ganadores de playoff
    // Por ahora, retornamos false como placeholder
    // TODO: Implementar lógica real basada en resultados de partidos
    return false;
  }

  /**
   * Encuentra la mejor liga para un equipo en una división específica
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

    // Obtener ligas disponibles en la división, ordenadas por espacios disponibles
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
      .orderBy(asc(leagueTable.groupCode));

    if (availableLeagues.length === 0) {
      throw new Error(`No hay espacios disponibles en División ${divisionLevel}`);
    }

    // Retornar la primera liga disponible (grupo A preferido)
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
