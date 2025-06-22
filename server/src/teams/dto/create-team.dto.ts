import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  tiktokId: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  followers?: number;

  @IsString()
  @IsOptional()
  description?: string;
}
