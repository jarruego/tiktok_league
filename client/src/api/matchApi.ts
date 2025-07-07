import type { 
  Match, 
  MatchesResponse, 
  GenerateMatchesRequest, 
  MatchFilters 
} from '../types/match.types';
import { authService } from './authApi';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const matchApi = {
  /**
   * Generar todos los partidos para una temporada
   */
  async generateMatches(data: GenerateMatchesRequest): Promise<{ 
    message: string; 
    totalMatches: number; 
    leaguesProcessed: number; 
    startDate: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/matches/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Obtener partidos con filtros
   */
  async getMatches(filters: MatchFilters = {}): Promise<MatchesResponse> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });
    
    const response = await fetch(`${API_BASE_URL}/api/matches?${params}`, {
      headers: authService.getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Obtener partidos por temporada
   */
  async getMatchesBySeason(
    seasonId: number, 
    filters: Omit<MatchFilters, 'seasonId'> = {}
  ): Promise<MatchesResponse> {
    return this.getMatches({ ...filters, seasonId });
  },

  /**
   * Obtener partidos por liga
   */
  async getMatchesByLeague(
    leagueId: number, 
    filters: Omit<MatchFilters, 'leagueId'> = {}
  ): Promise<MatchesResponse> {
    return this.getMatches({ ...filters, leagueId });
  },

  /**
   * Obtener partidos por equipo
   */
  async getMatchesByTeam(
    teamId: number, 
    filters: Omit<MatchFilters, 'teamId'> = {}
  ): Promise<MatchesResponse> {
    return this.getMatches({ ...filters, teamId });
  },

  /**
   * Obtener un partido específico
   */
  async getMatch(id: number): Promise<Match> {
    const response = await fetch(`${API_BASE_URL}/api/matches/${id}`, {
      headers: authService.getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Actualizar un partido
   */
  async updateMatch(id: number, data: Partial<Match>): Promise<Match> {
    const response = await fetch(`${API_BASE_URL}/api/matches/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Eliminar un partido
   */
  async deleteMatch(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/matches/${id}`, {
      method: 'DELETE',
      headers: authService.getAuthHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
  },

  /**
   * Eliminar todos los partidos de una temporada
   */
  async deleteAllMatchesBySeason(seasonId: number): Promise<{ 
    message: string; 
    deletedCount: number; 
  }> {
    const response = await fetch(`${API_BASE_URL}/api/matches/season/${seasonId}`, {
      method: 'DELETE',
      headers: authService.getAuthHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Obtener estadísticas de partidos por temporada
   */
  async getSeasonStats(seasonId: number): Promise<{
    totalMatches: number;
    scheduledMatches: number;
    finishedMatches: number;
    totalMatchdays: number;
    leaguesCount: number;
  }> {
    const response = await this.getMatchesBySeason(seasonId, { limit: 1000 });
    
    const stats = {
      totalMatches: response.pagination.total,
      scheduledMatches: 0,
      finishedMatches: 0,
      totalMatchdays: 0,
      leaguesCount: 0
    };

    if (response.matches.length > 0) {
      const matchdays = new Set(response.matches.map(m => m.matchday));
      const leagues = new Set(response.matches.map(m => m.league.id));
      
      stats.totalMatchdays = matchdays.size;
      stats.leaguesCount = leagues.size;
      stats.scheduledMatches = response.matches.filter(m => m.status === 'scheduled').length;
      stats.finishedMatches = response.matches.filter(m => m.status === 'finished').length;
    }

    return stats;
  }
};
