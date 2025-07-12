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
        qualifiedForTournament: teamLeagueAssignmentTable.qualifiedForTournament,
        leagueNextSeason: teamLeagueAssignmentTable.leagueNextSeason
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
      let targetLeagueId = assignment.leagueNextSeason || assignment.currentLeagueId;
      let reason: TeamAssignmentPlan['reason'] = 'stays';
      let reasonDetails = 'Permanece en la misma división y liga';

      // Si leagueNextSeason está definido, usarlo SIEMPRE como destino y ajustar división objetivo
      if (assignment.leagueNextSeason) {
        // Buscar la división de la liga destino
        const [targetLeague] = await this.databaseService.db
          .select({ divisionId: leagueTable.divisionId })
          .from(leagueTable)
          .where(eq(leagueTable.id, assignment.leagueNextSeason));
        if (targetLeague) {
          // Buscar nivel de la división destino
          const [targetDivision] = await this.databaseService.db
            .select({ level: divisionTable.level })
            .from(divisionTable)
            .where(eq(divisionTable.id, targetLeague.divisionId));
          if (targetDivision) {
            targetDivisionLevel = targetDivision.level;
          }
        }
        reasonDetails = 'Asignación directa a liga destino (leagueNextSeason)';
      } else if (assignment.promotedNextSeason) {
        targetDivisionLevel = Math.max(1, assignment.divisionLevel - 1);
        reason = 'promotion';
        reasonDetails = `Asciende por méritos deportivos desde División ${assignment.divisionLevel}`;
        // Buscar hueco en la división superior
        targetLeagueId = await this.findBestLeagueForTeam(
          assignment.teamId,
          targetDivisionLevel,
          nextSeasonId
        );
      } else if (assignment.relegatedNextSeason) {
        targetDivisionLevel = Math.min(5, assignment.divisionLevel + 1);
        reason = 'relegation';
        reasonDetails = `Desciende por méritos deportivos desde División ${assignment.divisionLevel}`;
        // Buscar hueco en la división inferior
        targetLeagueId = await this.findBestLeagueForTeam(
          assignment.teamId,
          targetDivisionLevel,
          nextSeasonId
        );
      } else if (assignment.playoffNextSeason) {
        // Verificar si ganó el playoff (esto se determinaría por los resultados de los partidos)
        const wonPlayoff = await this.checkIfTeamWonPlayoff(assignment.teamId, currentSeasonId);
        if (wonPlayoff) {
          targetDivisionLevel = Math.max(1, assignment.divisionLevel - 1);
          reason = 'playoff_promotion';
          reasonDetails = `Asciende por ganar playoff desde División ${assignment.divisionLevel}`;
          // Buscar hueco en la división superior
          targetLeagueId = await this.findBestLeagueForTeam(
            assignment.teamId,
            targetDivisionLevel,
            nextSeasonId
          );
        } else {
          reasonDetails = `Permanece tras perder/no completar playoff en División ${assignment.divisionLevel}`;
        }
      }

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

    // 1. Separar equipos por tipo de movimiento
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
        const wonPlayoff = await this.checkIfTeamWonPlayoff(assignment.teamId, currentSeasonId);
        if (wonPlayoff) {
          playoffPromotions.push(assignment);
        } else {
          stays.push(assignment);
        }
      } else {
        stays.push(assignment);
      }
    }

    // 2. Asignar stays y promociones (incluyendo playoff)
    const assignedLeagues: Record<number, number[]> = {}; // leagueId -> teamIds
    const leagueTeamCount: Record<number, number> = {};

    // Stays: permanecen en su liga
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
      if (!assignedLeagues[assignment.currentLeagueId]) assignedLeagues[assignment.currentLeagueId] = [];
      assignedLeagues[assignment.currentLeagueId].push(assignment.teamId);
      leagueTeamCount[assignment.currentLeagueId] = (leagueTeamCount[assignment.currentLeagueId] || 0) + 1;
    }

    // Promotions y playoffPromotions
    for (const assignment of [...promotions, ...playoffPromotions]) {
      const targetDivisionLevel = Math.max(1, assignment.divisionLevel - 1);
      let targetLeagueId = assignment.leagueNextSeason || null;
      let reason: TeamAssignmentPlan['reason'] = assignment.promotedNextSeason ? 'promotion' : 'playoff_promotion';
      let reasonDetails = reason === 'promotion' ? `Asciende por méritos deportivos desde División ${assignment.divisionLevel}` : `Asciende por ganar playoff desde División ${assignment.divisionLevel}`;
      if (!targetLeagueId) {
        // Buscar hueco en la división superior
        targetLeagueId = await this.findBestLeagueForTeam(
          assignment.teamId,
          targetDivisionLevel,
          nextSeasonId
        );
      }
      assignmentPlan.push({
        teamId: assignment.teamId,
        teamName: assignment.teamName,
        currentDivisionLevel: assignment.divisionLevel,
        targetDivisionLevel,
        targetLeagueId,
        reason,
        reasonDetails
      });
      if (!assignedLeagues[targetLeagueId]) assignedLeagues[targetLeagueId] = [];
      assignedLeagues[targetLeagueId].push(assignment.teamId);
      leagueTeamCount[targetLeagueId] = (leagueTeamCount[targetLeagueId] || 0) + 1;
    }

    // 3. Calcular huecos en cada liga de la división inferior
    // Obtener ligas de la división inferior
    const divisionLevels = [...new Set(currentAssignments.map(a => a.divisionLevel))];
    for (const level of divisionLevels) {
      const nextLevel = level + 1;
      // Buscar ligas de la división inferior
      const db = this.databaseService.db;
      const lowerDivisionLeagues = await db
        .select({
          leagueId: leagueTable.id,
          maxTeams: leagueTable.maxTeams
        })
        .from(leagueTable)
        .innerJoin(divisionTable, eq(leagueTable.divisionId, divisionTable.id))
        .where(eq(divisionTable.level, nextLevel));
      // Inicializar conteo de equipos por liga
      for (const league of lowerDivisionLeagues) {
        leagueTeamCount[league.leagueId] = leagueTeamCount[league.leagueId] || 0;
      }
      // 4. Repartir descendidos en los huecos, respetando leagueNextSeason si está asignado
      const relegatedTeams = relegations.filter(a => a.divisionLevel === level);
      let leagueIndex = 0;
      for (const team of relegatedTeams) {
        let assigned = false;
        let targetLeagueId = team.leagueNextSeason || null;
        if (targetLeagueId) {
          // Si ya tiene slot asignado, usarlo y aumentar el contador
          assignmentPlan.push({
            teamId: team.teamId,
            teamName: team.teamName,
            currentDivisionLevel: team.divisionLevel,
            targetDivisionLevel: nextLevel,
            targetLeagueId,
            reason: 'relegation',
            reasonDetails: `Desciende por méritos deportivos desde División ${team.divisionLevel} (slot asignado manualmente)`
          });
          leagueTeamCount[targetLeagueId] = (leagueTeamCount[targetLeagueId] || 0) + 1;
          assigned = true;
        } else {
          // Buscar siguiente liga con hueco
          for (let i = 0; i < lowerDivisionLeagues.length; i++) {
            const idx = (leagueIndex + i) % lowerDivisionLeagues.length;
            const league = lowerDivisionLeagues[idx];
            if (leagueTeamCount[league.leagueId] < league.maxTeams) {
              assignmentPlan.push({
                teamId: team.teamId,
                teamName: team.teamName,
                currentDivisionLevel: team.divisionLevel,
                targetDivisionLevel: nextLevel,
                targetLeagueId: league.leagueId,
                reason: 'relegation',
                reasonDetails: `Desciende por méritos deportivos desde División ${team.divisionLevel}`
              });
              leagueTeamCount[league.leagueId]++;
              assigned = true;
              leagueIndex = idx + 1;
              break;
            }
          }
        }
        if (!assigned) {
          throw new Error(`No hay hueco para el equipo descendido ${team.teamName} en la división ${nextLevel}`);
        }
      }
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
