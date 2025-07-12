import { authService } from './authApi';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Asignar manualmente los equipos descendidos a los huecos vacantes tras playoffs
export async function assignRelegatedTeamsToVacantSlots(): Promise<{ message: string; assigned: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/season-transition/assign-relegated-teams`, {
    method: 'POST',
    headers: authService.getAuthHeaders(),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function recalculateAllStandingsAndStates(): Promise<{ message: string; processedDivisions: number; errors: string[] }> {
  const response = await fetch(`${API_BASE_URL}/api/season-transition/recalculate-standings`, {
    method: 'POST',
    headers: authService.getAuthHeaders(),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function checkActiveSeasonComplete(): Promise<{
  isComplete: boolean;
  readyForNewSeason: boolean;
  pendingIssues: string[];
  seasonId: number;
  seasonName: string;
  summary: {
    promotions: number;
    relegations: number;
    tournamentQualifiers: number;
    pendingPlayoffs: number;
    errors: number;
  };
}> {
  console.log('[DEBUG API] Llamando a checkActiveSeasonComplete...');
  const response = await fetch(`${API_BASE_URL}/api/season-transition/active-season/is-complete`, {
    method: 'GET',
    headers: authService.getAuthHeaders(),
  });
  
  console.log('[DEBUG API] Response status:', response.status);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[DEBUG API] Error response:', errorData);
    throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
  }
  
  const result = await response.json();
  console.log('[DEBUG API] Resultado recibido:', result);
  return result;
}

export async function createNewSeasonFromCompleted(data: {
  completedSeasonId?: number;
  newSeasonName?: string;
}): Promise<{
  success: boolean;
  message: string;
  newSeasonId?: number;
  newSeasonName?: string;
  previousSeasonClosed: boolean;
  transitionSummary: {
    promotedTeams: number;
    relegatedTeams: number;
    tournamentQualified: number;
    teamsTransitioned: number;
  };
}> {
  console.log('[DEBUG API] Llamando a createNewSeasonFromCompleted con data:', data);
  const response = await fetch(`${API_BASE_URL}/api/season-transition/create-new-season`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authService.getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  
  console.log('[DEBUG API] Response status para create season:', response.status);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[DEBUG API] Error response:', errorData);
    throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
  }
  
  const result = await response.json();
  console.log('[DEBUG API] Resultado recibido para create season:', result);
  return result;
}



