import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateDivisionDto {
  @IsInt()
  @Min(1)
  @Max(5)
  level: number;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  totalLeagues: number;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(20)
  teamsPerLeague?: number = 20;

  @IsOptional()
  @IsInt()
  @Min(0)
  promoteSlots?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  promotePlayoffSlots?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  relegateSlots?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  tournamentSlots?: number = 0;
}
