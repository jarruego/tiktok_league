import { IsString, IsInt, IsOptional } from 'class-validator';

export class CreateLeagueDto {
  @IsString()
  name: string;

  @IsString()
  groupCode: string;

  @IsInt()
  divisionId: number;

  @IsOptional()
  @IsInt()
  maxTeams?: number = 20;

  @IsOptional()
  @IsString()
  description?: string;
}
