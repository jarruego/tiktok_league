import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FootballDataTeamResponseDto } from '../players/dto/football-data.dto';

@Injectable()
export class FootballDataService {
  private readonly apiUrl = 'https://api.football-data.org/v4';
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('FOOTBALL_DATA_API_KEY') || '';
  }

  private getHeaders() {
    if (!this.apiKey) {
      throw new Error('FOOTBALL_DATA_API_KEY not configured');
    }
    
    return {
      'X-Auth-Token': this.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'Foodball-App/1.0',
    };
  }

  async getTeam(teamId: number): Promise<FootballDataTeamResponseDto> {
    try {
      console.log(`🔄 Fetching team ${teamId} from Football-Data.org...`);
      console.log(`📡 API Key: ${this.apiKey.substring(0, 8)}...`);
      
      const response = await fetch(`${this.apiUrl}/teams/${teamId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      console.log(`📊 Response status: ${response.status}`);
      console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error Response:`, errorText);
        throw new Error(`Football-Data.org API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ Successfully fetched team: ${data.name}`);
      return data;
    } catch (error) {
      console.error(`❌ Failed to fetch team ${teamId}:`, error.message);
      throw new Error(`Failed to fetch team data: ${error.message}`);
    }
  }

  async getCompetition(competitionId: number) {
    try {
      const response = await fetch(`${this.apiUrl}/competitions/${competitionId}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Football-Data.org API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to fetch competition data: ${error.message}`);
    }
  }

  async getCompetitionTeams(competitionId: number) {
    try {
      const response = await fetch(`${this.apiUrl}/competitions/${competitionId}/teams`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Football-Data.org API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to fetch competition teams: ${error.message}`);
    }
  }

  // Método de utilidad para validar si el API key está configurado
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // Información sobre límites de la API
  getApiInfo() {
    return {
      configured: this.isConfigured(),
      baseUrl: this.apiUrl,
      rateLimit: '10 requests per minute for free tier',
      note: 'Free tier has limited access to competitions and teams'
    };
  }
}
