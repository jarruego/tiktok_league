import { IsOptional, IsInt, Min, IsString, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetMatchesQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => value ? parseInt(value) : undefined)
  seasonId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => value ? parseInt(value) : undefined)
  leagueId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => value ? parseInt(value) : undefined)
  divisionId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => value ? parseInt(value) : undefined)
  teamId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => value ? parseInt(value) : undefined)
  matchday?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => value ? parseInt(value) : 1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => value ? parseInt(value) : 50)
  limit?: number = 50;
}
