export interface Player {
  id: number;
  name: string;
  position: string;
  teamId: number;
}

export interface Lineup {
  Goalkeeper: string[];
  Defence: string[];
  Midfield: string[];
  Forward: string[];
}
