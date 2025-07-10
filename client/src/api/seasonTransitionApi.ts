import { authService } from './authApi';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export async function organizeAllPlayoffs(): Promise<{ message: string; playoffMatches: number }> {
  const response = await fetch(`${API_BASE_URL}/api/season-transition/organize-playoffs`, {
    method: 'POST',
    headers: authService.getAuthHeaders(),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}
