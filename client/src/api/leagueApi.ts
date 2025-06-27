import type { Division, Season, TeamInLeague } from '../types/league.types';

const API_BASE_URL = 'http://localhost:3000';

export const leagueApi = {
  // Verificar estado del sistema
  async getSystemStatus(): Promise<{
    isInitialized: boolean;
    hasAssignments: boolean;
    message: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/league-system/status`);
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
    const response = await fetch(`${API_BASE_URL}/league-system/assignments/${seasonId}/status`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },
  // Obtener estructura de divisiones y ligas
  async getDivisionStructure(): Promise<Division[]> {
    const response = await fetch(`${API_BASE_URL}/league-system/structure`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // Obtener temporada activa
  async getActiveSeason(): Promise<Season> {
    const response = await fetch(`${API_BASE_URL}/league-system/seasons/active`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // Obtener todas las temporadas
  async getAllSeasons(): Promise<Season[]> {
    const response = await fetch(`${API_BASE_URL}/league-system/seasons`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // Obtener equipos de una liga específica
  async getTeamsInLeague(leagueId: number, seasonId: number): Promise<TeamInLeague[]> {
    const response = await fetch(`${API_BASE_URL}/league-system/leagues/${leagueId}/teams/${seasonId}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // Inicializar sistema de ligas (ahora idempotente)
  async initializeLeagueSystem(): Promise<{
    message: string;
    isNewSystem: boolean;
    existingAssignments?: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/league-system/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  },

  // Resetear sistema completo (PELIGROSO - solo desarrollo)
  async resetLeagueSystem(): Promise<{
    message: string;
    warning: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/league-system/reset`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const response = await fetch(`${API_BASE_URL}/league-system/seasons`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const response = await fetch(`${API_BASE_URL}/league-system/assign-teams/${seasonId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
};
