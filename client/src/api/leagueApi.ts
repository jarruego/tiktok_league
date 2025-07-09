import type { Division, Season, TeamInLeague } from '../types/league.types';
import { authService } from './authApi';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const leagueApi = {
  // Verificar estado del sistema
  async getSystemStatus(): Promise<{
    isInitialized: boolean;
    hasAssignments: boolean;
    message: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/league-system/status`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // Verificar estado de asignaciones para una temporada
  async getAssignmentStatus(seasonId: number): Promise<{
    seasonId: number;
    hasAssignments: boolean;
    message: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/league-system/assignments/${seasonId}/status`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  // Obtener estructura de divisiones y ligas
  async getDivisionStructure(): Promise<Division[]> {
    const response = await fetch(`${API_BASE_URL}/api/league-system/structure`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // Obtener temporada activa
  async getActiveSeason(): Promise<Season> {
    const response = await fetch(`${API_BASE_URL}/api/league-system/seasons/active`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // Obtener todas las temporadas
  async getAllSeasons(): Promise<Season[]> {
    const response = await fetch(`${API_BASE_URL}/api/league-system/seasons`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // Obtener equipos de una liga específica
  async getTeamsInLeague(leagueId: number, seasonId: number): Promise<TeamInLeague[]> {
    const response = await fetch(`${API_BASE_URL}/api/league-system/leagues/${leagueId}/teams/${seasonId}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // Inicializar sistema de ligas (ahora idempotente)
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
    const response = await fetch(`${API_BASE_URL}/api/league-system/initialize${runSeed ? '?seed=true' : ''}`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // Ejecutar seed de inicialización de la BD
  async runDatabaseSeed(): Promise<{
    message?: string;
    success?: boolean;
    details?: string;
    isNewSystem?: boolean;
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
    // Usamos el endpoint de inicialización con el parámetro seed=true
    return this.initializeLeagueSystem(true);
  },

  // Resetear sistema completo (PELIGROSO - solo desarrollo)
  async resetLeagueSystem(): Promise<{
    message: string;
    warning: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/league-system/reset`, {
      method: 'DELETE',
      headers: authService.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // Resetear asignaciones de una temporada específica
  async resetSeasonAssignments(seasonId: number): Promise<{
    message: string;
    deletedAssignments: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/league-system/reset/season/${seasonId}`, {
      method: 'DELETE',
      headers: authService.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // Crear temporada
  async createSeason(seasonData: {
    name: string;
    year: number;
    isActive?: boolean;
    startDate?: string;
    endDate?: string;
  }): Promise<Season> {
    const response = await fetch(`${API_BASE_URL}/api/league-system/seasons`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
      body: JSON.stringify(seasonData),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // Asignar equipos por seguidores de TikTok (ahora idempotente)
  async assignTeamsByTikTokFollowers(seasonId: number): Promise<{
    message: string;
    assignedTeams: number;
    skippedTeams: number;
    totalTeams: number;
    wasAlreadyAssigned: boolean;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/league-system/assign-teams/${seasonId}`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
};
