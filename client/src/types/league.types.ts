// Tipos para el sistema de ligas
export interface Division {
  id: number;
  level: number;
  name: string;
  description?: string;
  totalLeagues: number;
  teamsPerLeague: number;
  promoteSlots: number;
  promotePlayoffSlots: number;
  relegateSlots: number;
  europeanSlots: number;
  leagues: League[];
}

export interface League {
  id: number;
  name: string;
  groupCode: string;
  maxTeams: number;
}

export interface Season {
  id: number;
  name: string;
  year: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamInLeague {
  teamId: number;
  teamName: string;
  shortName?: string;
  crest?: string;
  tiktokFollowers: number;
  followersAtAssignment: number;
  assignmentReason: number;
}

export interface TeamStanding {
  position: number;
  team?: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface ExtendedTeamInLeague extends TeamInLeague {
  position?: number;
  standing?: TeamStanding;
}
