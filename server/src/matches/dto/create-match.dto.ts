import { IsInt, IsNotEmpty, IsOptional, IsDateString, Min } from 'class-validator';

export class CreateMatchDto {
  @IsInt()
  @Min(1)
  seasonId: number;

  @IsInt()
  @Min(1)
  leagueId: number;

  @IsInt()
  @Min(1)
  homeTeamId: number;

  @IsInt()
  @Min(1)
  awayTeamId: number;

  @IsInt()
  @Min(1)
  matchday: number;

  @IsDateString()
  scheduledDate: string;

  @IsOptional()
  notes?: string;
}

export class GenerateMatchesDto {
  @IsInt()
  @Min(1)
  seasonId: number;

  @IsOptional()
  @IsDateString()
  startDate?: string; // Si no se proporciona, usa la fecha de inicio de la temporada

  @IsOptional()
  @IsInt()
  @Min(1)
  daysPerMatchday?: number = 7; // Días entre jornadas (por defecto 7 días = 1 semana)
}
