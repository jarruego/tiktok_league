import { authService } from './authApi';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export async function recalculateAllStandings(seasonId: number): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/matches/standings/recalculate/season/${seasonId}`, {
    method: 'POST',
    headers: authService.getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}
