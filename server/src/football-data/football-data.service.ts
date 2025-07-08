import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FOOTBALL_DATA_API_URL } from '../config/football-data.config';
import { FootballDataTeamResponseDto } from '../players/dto/football-data.dto';

@Injectable()
export class FootballDataService {
  private readonly apiUrl = FOOTBALL_DATA_API_URL;
  private readonly apiKey: string;
  private readonly requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 12000; // 12 segundos entre requests para API gratuita
  private retryCount = new Map<string, number>();

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

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      console.log(`⏱️  Rate limiting: waiting ${waitTime}ms before next request...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  private async makeRequest<T>(requestId: string, requestFn: () => Promise<T>): Promise<T> {
    await this.waitForRateLimit();
    
    try {
      const result = await requestFn();
      // Reset retry count on success
      this.retryCount.delete(requestId);
      return result;
    } catch (error) {
      if (error.message.includes('429')) {
        const retries = this.retryCount.get(requestId) || 0;
        if (retries < 3) {
          this.retryCount.set(requestId, retries + 1);
          const backoffTime = Math.pow(2, retries) * 30000; // Exponential backoff: 30s, 60s, 120s
          console.log(`🔄 Rate limit hit for ${requestId}. Retry ${retries + 1}/3 in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          return this.makeRequest(requestId, requestFn);
        } else {
          console.error(`❌ Max retries reached for ${requestId}`);
          throw new Error(`Rate limit exceeded after 3 retries for ${requestId}`);
        }
      }
      throw error;
    }
  }

  async getTeam(teamId: number): Promise<FootballDataTeamResponseDto> {
    const requestId = `team-${teamId}`;
    
    return this.makeRequest(requestId, async () => {
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
    });
  }

  async getCompetition(competitionId: number) {
    const requestId = `competition-${competitionId}`;
    
    return this.makeRequest(requestId, async () => {
      const response = await fetch(`${this.apiUrl}/competitions/${competitionId}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Football-Data.org API error: ${response.status}`);
      }

      return await response.json();
    });
  }

  async getCompetitionTeams(competitionId: number) {
    const requestId = `competition-teams-${competitionId}`;
    
    return this.makeRequest(requestId, async () => {
      console.log(`🔄 Fetching teams for competition ${competitionId}...`);
      
      const response = await fetch(`${this.apiUrl}/competitions/${competitionId}/teams`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Football-Data.org API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ Successfully fetched ${data.count || data.teams?.length || 0} teams for competition ${competitionId}`);
      return data;
    });
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
