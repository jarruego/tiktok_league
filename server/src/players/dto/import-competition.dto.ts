import { IsNumber, IsOptional, IsBoolean, IsString } from 'class-validator';

export class ImportCompetitionDto {
  @IsNumber()
  competitionId: number; // ID de Football-Data (ej: 2014 para La Liga)

  @IsOptional()
  @IsBoolean()
  updateExisting?: boolean = true; // Actualizar equipos existentes

  @IsOptional()
  @IsBoolean()
  importPlayers?: boolean = true; // Importar jugadores

  @IsOptional()
  @IsBoolean()
  importCoaches?: boolean = true; // Importar entrenadores

  @IsOptional()
  @IsString()
  source?: string = 'football-data.org';
}
