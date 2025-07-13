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

    // 1. Agrupar equipos por división y tipo de movimiento
    const stays: any[] = [];
    const promotions: any[] = [];
    const playoffPromotions: any[] = [];
    const relegations: any[] = [];

    for (const assignment of currentAssignments) {
      if (assignment.promotedNextSeason) {
        promotions.push(assignment);
      } else if (assignment.relegatedNextSeason) {
        relegations.push(assignment);
      } else if (assignment.playoffNextSeason) {
        stays.push(assignment);
      } else {
        stays.push(assignment);
      }
    }

    // 2. Calcular huecos disponibles en cada liga de cada división
    // Para cada división, los huecos son los equipos que ascienden o descienden (dejan vacante)
    const divisionLevels = [...new Set(currentAssignments.map(a => a.divisionLevel))];
    const leagueVacancies: Record<number, number[]> = {};
    for (const level of divisionLevels) {
      const leagues = await this.getLeaguesByDivisionLevel(level);
      leagueVacancies[level] = leagues.map(l => l.id);
    }

    // 3. Asignar promociones y descensos a los huecos de destino

    // a) Ascendidos: ocuparán huecos en la división superior (pero no si ya están en la división 1)
    for (const assignment of promotions) {
      if (assignment.divisionLevel === 1) {
        // No se puede ascender desde la división 1, permanece
        assignmentPlan.push({
          teamId: assignment.teamId,
          teamName: assignment.teamName,
          currentDivisionLevel: assignment.divisionLevel,
          targetDivisionLevel: assignment.divisionLevel,
          targetLeagueId: assignment.currentLeagueId,
          reason: 'stays',
          reasonDetails: 'Permanece en la máxima división (no puede ascender más)'
        });
        continue;
      }
      const targetDivisionLevel = assignment.divisionLevel - 1;
      const targetLeagues = leagueVacancies[targetDivisionLevel] || [];
      if (targetLeagues.length === 0) throw new Error(`No hay ligas disponibles en división ${targetDivisionLevel}`);
      const targetLeagueId = targetLeagues.shift();
      if (typeof targetLeagueId !== 'number') throw new Error(`No se pudo asignar liga para ascenso en división ${targetDivisionLevel}`);
      assignmentPlan.push({
        teamId: assignment.teamId,
        teamName: assignment.teamName,
        currentDivisionLevel: assignment.divisionLevel,
        targetDivisionLevel,
        targetLeagueId,
        reason: 'promotion',
        reasonDetails: `Asciende por méritos deportivos desde División ${assignment.divisionLevel}`
      });
    }

    // b) Playoff-promotions: igual que ascensos (pero no si ya están en la división 1)
    for (const assignment of playoffPromotions) {
      if (assignment.divisionLevel === 1) {
        // No se puede ascender desde la división 1, permanece
        assignmentPlan.push({
          teamId: assignment.teamId,
          teamName: assignment.teamName,
          currentDivisionLevel: assignment.divisionLevel,
          targetDivisionLevel: assignment.divisionLevel,
          targetLeagueId: assignment.currentLeagueId,
          reason: 'stays',
          reasonDetails: 'Permanece en la máxima división (no puede ascender más)'
        });
        continue;
      }
      const targetDivisionLevel = assignment.divisionLevel - 1;
      const targetLeagues = leagueVacancies[targetDivisionLevel] || [];
      if (targetLeagues.length === 0) throw new Error(`No hay ligas disponibles en división ${targetDivisionLevel}`);
      const targetLeagueId = targetLeagues.shift();
      if (typeof targetLeagueId !== 'number') throw new Error(`No se pudo asignar liga para ascenso por playoff en división ${targetDivisionLevel}`);
      assignmentPlan.push({
        teamId: assignment.teamId,
        teamName: assignment.teamName,
        currentDivisionLevel: assignment.divisionLevel,
        targetDivisionLevel,
        targetLeagueId,
        reason: 'playoff_promotion',
        reasonDetails: `Asciende por ganar playoff desde División ${assignment.divisionLevel}`
      });
    }

    // c) Descendidos: ocuparán huecos en la división inferior (pero no si ya están en la última división)
    const maxDivisionLevel = Math.max(...divisionLevels);
    for (const assignment of relegations) {
      if (assignment.divisionLevel === maxDivisionLevel) {
        // No se puede descender más, permanece
        assignmentPlan.push({
          teamId: assignment.teamId,
          teamName: assignment.teamName,
          currentDivisionLevel: assignment.divisionLevel,
          targetDivisionLevel: assignment.divisionLevel,
          targetLeagueId: assignment.currentLeagueId,
          reason: 'stays',
          reasonDetails: 'Permanece en la división más baja (no puede descender más)'
        });
        continue;
      }
      const targetDivisionLevel = assignment.divisionLevel + 1;
      const targetLeagues = leagueVacancies[targetDivisionLevel] || [];
      if (targetLeagues.length === 0) throw new Error(`No hay ligas disponibles en división ${targetDivisionLevel}`);
      const targetLeagueId = targetLeagues.shift();
      if (typeof targetLeagueId !== 'number') throw new Error(`No se pudo asignar liga para descenso en división ${targetDivisionLevel}`);
      assignmentPlan.push({
        teamId: assignment.teamId,
        teamName: assignment.teamName,
        currentDivisionLevel: assignment.divisionLevel,
        targetDivisionLevel,
        targetLeagueId,
        reason: 'relegation',
        reasonDetails: `Desciende por méritos deportivos desde División ${assignment.divisionLevel}`
      });
    }

    // d) Stays: permanecen en su liga
    for (const assignment of stays) {
      assignmentPlan.push({
        teamId: assignment.teamId,
        teamName: assignment.teamName,
        currentDivisionLevel: assignment.divisionLevel,
        targetDivisionLevel: assignment.divisionLevel,
        targetLeagueId: assignment.currentLeagueId,
        reason: 'stays',
        reasonDetails: 'Permanece en la misma división y liga'
      });
    }

    // Ordenar por prioridad: ascensos primero, luego playoff, luego stays, luego descensos
    assignmentPlan.sort((a, b) => {
      const priorityOrder = { 'promotion': 1, 'playoff_promotion': 2, 'stays': 3, 'relegation': 4 };
      const aPriority = priorityOrder[a.reason];
      const bPriority = priorityOrder[b.reason];
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.targetDivisionLevel - b.targetDivisionLevel;
    });

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
