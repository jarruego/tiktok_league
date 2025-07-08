import { IsOptional, IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SimulateMatchesByDateDto {
  @IsDateString()
  date: string; // Formato YYYY-MM-DD
}

export class SimulateSingleMatchDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  matchId: number;
}

export class SimulateMatchesQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  seasonId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  leagueId?: number;
}
