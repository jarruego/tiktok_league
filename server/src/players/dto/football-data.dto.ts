import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, ValidateNested, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export class FootballDataCoachDto {
  @IsInt()
  id: number;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  nationality?: string;
}

export class FootballDataPlayerDto {
  @IsInt()
  id: number;

  @IsString()
  name: string;

  @IsString()
  position: string;

  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  nationality?: string;

  @IsInt()
  @IsOptional()
  shirtNumber?: number;

  @IsString()
  @IsOptional()
  role?: string;
}

export class FootballDataTeamResponseDto {
  @IsInt()
  id: number;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  shortName?: string;

  @IsString()
  @IsOptional()
  tla?: string; // Three Letter Abbreviation

  @IsUrl()
  @IsOptional()
  crest?: string;

  @IsString()
  @IsOptional()
  venue?: string;

  @IsInt()
  @IsOptional()
  founded?: number;

  @IsString()
  @IsOptional()
  clubColors?: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FootballDataCoachDto)
  coach?: FootballDataCoachDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FootballDataPlayerDto)
  squad: FootballDataPlayerDto[];
}

export class ImportTeamFromFootballDataDto {
  @IsInt()
  @IsNotEmpty()
  teamId: number; // ID del equipo en tu base de datos

  @IsInt()
  @IsNotEmpty()
  footballDataTeamId: number; // ID del equipo en Football-Data.org

  @IsString()
  @IsOptional()
  source?: string;
}
