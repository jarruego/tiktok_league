import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsUrl } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  tiktokId: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  followers?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  following?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  likes?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  profileUrl?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  // Nuevos campos para Football-Data.org
  @IsInt()
  @IsOptional()
  footballDataId?: number;

  @IsInt()
  @IsOptional()
  competitionId?: number;

  @IsString()
  @IsOptional()
  shortName?: string;

  @IsString()
  @IsOptional()
  tla?: string;

  @IsUrl()
  @IsOptional()
  crest?: string;

  @IsString()
  @IsOptional()
  venue?: string;

  @IsInt()
  @Min(1800)
  @IsOptional()
  founded?: number;

  @IsString()
  @IsOptional()
  clubColors?: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @IsInt()
  @IsOptional()
  coachId?: number;
}
