import type { 
  Match, 
  MatchesResponse, 
  GenerateMatchesRequest,
  GenerateMatchesResponse,
  MatchFilters 
} from '../types/match.types';
import { authService } from './authApi';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const matchApi = {
  /**
   * Generar todos los partidos para una temporada
   */
  async generateMatches(data: GenerateMatchesRequest): Promise<GenerateMatchesResponse> {
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
    
    const url = `${API_BASE_URL}/api/matches?${params}`;
    console.log('🔍 [DEBUG] Making request to:', url);
    console.log('🔍 [DEBUG] API_BASE_URL:', API_BASE_URL);
    console.log('🔍 [DEBUG] Filters:', filters);
    
    const response = await fetch(url, {
      headers: authService.getAuthHeaders(),
    });
    
    console.log('🔍 [DEBUG] Response status:', response.status, response.statusText);
    
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
  },

  // ==========================================
  // CLASIFICACIONES Y ESTADÍSTICAS
  // ==========================================

  /**
   * Obtener clasificación de una liga
   */
  async getLeagueStandings(leagueId: number, seasonId: number): Promise<{
    id: number;
    teamId: number;
    teamName: string;
    teamCrest: string | null;
    position: number;
    matchesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
  }[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/matches/standings/league/${leagueId}/season/${seasonId}`,
      {
        headers: authService.getAuthHeaders(),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    // El backend devuelve { league, division, standings }, extraemos solo standings
    return data.standings || [];
  },

  /**
   * Obtener clasificaciones de una temporada completa
   */
  async getSeasonStandings(seasonId: number): Promise<{
    [leagueId: number]: {
      id: number;
      teamId: number;
      teamName: string;
      teamCrest: string | null;
      position: number;
      matchesPlayed: number;
      wins: number;
      draws: number;
      losses: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
      points: number;
    }[];
  }> {
    const response = await fetch(
      `${API_BASE_URL}/api/matches/standings/season/${seasonId}`,
      {
        headers: authService.getAuthHeaders(),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    // El backend devuelve un array de { league, division, standings }
    // Convertimos a objeto con leagueId como clave
    const result: { [leagueId: number]: any[] } = {};
    data.forEach((leagueData: any) => {
      result[leagueData.league.id] = leagueData.standings || [];
    });
    return result;
  },

  /**
   * Recalcular clasificaciones de una temporada
   */
  async recalculateStandings(seasonId: number): Promise<{
    message: string;
    updatedStandings?: number;
  }> {
    const response = await fetch(
      `${API_BASE_URL}/api/matches/standings/recalculate/season/${seasonId}`,
      {
        method: 'POST',
        headers: authService.getAuthHeaders(),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Simular partidos por fecha
   */
  async simulateMatchesByDate(date: string): Promise<{
    length: number;
    results: Array<{
      matchId: number;
      homeTeamName: string;
      awayTeamName: string;
      homeGoals: number;
      awayGoals: number;
      algorithmDetails: {
        homeTeamFollowers: number;
        awayTeamFollowers: number;
        followersDifference: number;
        randomEvents: number;
        followerBasedEvents: number;
      };
    }>;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/matches/simulate/date`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({ date }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    const results = await response.json();
    return {
      length: results.length,
      results
    };
  },

  /**
   * Simular un partido específico
   */
  async simulateSingleMatch(matchId: number): Promise<{
    matchId: number;
    homeTeamName: string;
    awayTeamName: string;
    homeGoals: number;
    awayGoals: number;
    algorithmDetails: any;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/matches/simulate/${matchId}`, {
      method: 'POST',
      headers: authService.getAuthHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Simular todos los partidos pendientes
   */
  async simulateAllPendingMatches(): Promise<{
    length: number;
    results: Array<any>;
  }> {
    const headers = authService.getAuthHeaders();
    console.log('🔍 [DEBUG] Headers a enviar:', headers);
    console.log('🔍 [DEBUG] URL completa:', `${API_BASE_URL}/api/matches/simulate/all`);
    
    const response = await fetch(`${API_BASE_URL}/api/matches/simulate/all`, {
      method: 'GET',
      headers,
    });
    
    console.log('🔍 [DEBUG] Response status:', response.status);
    console.log('🔍 [DEBUG] Response ok:', response.ok);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.log('🔍 [DEBUG] Error data:', errorData);
      
      // Mejor manejo de errores de autenticación
      if (response.status === 401) {
        throw new Error('No tienes permisos para realizar esta acción. Por favor, inicia sesión nuevamente.');
      }
      
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    const results = await response.json();
    console.log('🔍 [DEBUG] Results:', results);
    return {
      length: results.length,
      results
    };
  },

  /**
   * Obtener estadísticas de simulación
   */
  async getSimulationStats(): Promise<{
    totalMatches: number;
    scheduledMatches: number;
    finishedMatches: number;
    averageGoalsPerMatch: number;
    homeWins: number;
    awayWins: number;
    draws: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/matches/simulation/stats`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  },

  /**
   * Simular la siguiente jornada
   * Encuentra partidos programados para la próxima fecha y los simula
   */
  async simulateNextMatchday(): Promise<{
    date: string;
    matchesSimulated: number;
    results: Array<any>;
  }> {
    // Primero obtenemos todos los partidos programados
    const scheduledMatches = await this.getMatches({ 
      status: 'scheduled',
      limit: 1000 
    });

    if (scheduledMatches.matches.length === 0) {
      throw new Error('No hay partidos programados para simular');
    }

    // Encontrar la fecha más próxima
    const dates = scheduledMatches.matches.map(m => m.scheduledDate);
    const uniqueDates = [...new Set(dates)].sort();
    const nextDate = uniqueDates[0];

    if (!nextDate) {
      throw new Error('No se pudo determinar la siguiente fecha de partidos');
    }

    // Simular partidos de esa fecha
    const result = await this.simulateMatchesByDate(nextDate);
    
    return {
      date: nextDate,
      matchesSimulated: result.length,
      results: result.results
    };
  }
};
