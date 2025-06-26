import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

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
}
