import type { Division, Season, TeamInLeague } from '../types/league.types';

const API_BASE_URL = 'http://localhost:3000';

export const leagueApi = {
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

  // Inicializar sistema de ligas
  async initializeLeagueSystem(): Promise<{ message: string }> {
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

  // Asignar equipos por seguidores de TikTok
  async assignTeamsByTikTokFollowers(seasonId: number): Promise<{ message: string; assignedTeams: number; totalTeams: number }> {
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
