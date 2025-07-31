// Interfaz base común para equipos en toda la app
export interface TeamCommon {
  id: number;
  name: string;
  crest?: string;
  avatarUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  shortName?: string;
}

// Ejemplo de extensión para DivisionView
export interface ExtendedTeamInLeague extends TeamCommon {
  teamId: number; // para compatibilidad con datos antiguos
  teamName: string;
  tiktokFollowers: number;
  followersAtAssignment: number;
  standing?: any;
  position?: number;
  // ...otros campos específicos...
}
