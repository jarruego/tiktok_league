// Tipos para el sistema de partidos

export interface Match {
  id: number;
  matchday: number;
  scheduledDate: string;
  status: MatchStatus;
  homeGoals?: number;
  awayGoals?: number;
  notes?: string;
  isPlayoff?: boolean;
  playoffRound?: string;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  league: LeagueInfo;
  division: DivisionInfo;
}

export interface TeamInfo {
  id: number;
  name: string;
  shortName?: string;
  crest?: string;
}

export interface LeagueInfo {
  id: number;
  name: string;
  groupCode: string;
}

export interface DivisionInfo {
  id: number;
  name: string;
  level: number;
}

export const MatchStatus = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
  POSTPONED: 'postponed',
  CANCELLED: 'cancelled'
} as const;

export type MatchStatus = typeof MatchStatus[keyof typeof MatchStatus];

export interface MatchesResponse {
  matches: Match[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GenerateMatchesRequest {
  seasonId: number;
  startDate?: string;
  daysPerMatchday?: number;
}

export interface GenerateMatchesResponse {
  message: string;
  totalMatches: number;
  leaguesProcessed: number;
  startDate: string;
  leagueResults?: LeagueGenerationResult[];
}

export interface LeagueGenerationResult {
  leagueId: number;
  leagueName: string;
  teamsCount: number;
  matchesGenerated: number;
  verification: {
    isValid: boolean;
    errors: string[];
    stats: {
      expectedMatches: number;
      actualMatches: number;
      expectedMatchesPerTeam: number;
      teamsStats: {
        teamId: number;
        homeMatches: number;
        awayMatches: number;
        totalMatches: number;
      }[];
    };
  };
}

export interface MatchFilters {
  seasonId?: number;
  leagueId?: number;
  divisionId?: number;
  teamId?: number;
  matchday?: number;
  status?: MatchStatus;
  fromDate?: string;
  toDate?: string;
  isPlayoff?: boolean;
  playoffRound?: string;
  page?: number;
  limit?: number;
}

// Para la vista agrupada por jornadas
export interface MatchdayGroup {
  matchday: number;
  date: string;
  matches: Match[];
}

// Para la vista agrupada por ligas/divisiones
export interface LeagueMatchesGroup {
  league: LeagueInfo;
  division: DivisionInfo;
  matches: Match[];
  matchdays: MatchdayGroup[];
}
