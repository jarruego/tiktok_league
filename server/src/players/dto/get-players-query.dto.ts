import { IsOptional, IsInt, IsString } from 'class-validator';

export class GetPlayersQueryDto {
  @IsOptional()
  @IsInt()
  teamId?: number;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  role?: string;
}
