import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsDateString, IsIn } from 'class-validator';

export class CreatePlayerDto {
  @IsInt()
  @IsNotEmpty()
  teamId: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  position: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  nationality?: string;

  @IsInt()
  @Min(1)
  @Max(99)
  @IsOptional()
  shirtNumber?: number;

  @IsString()
  @IsIn(['PLAYER', 'CAPTAIN', 'VICE_CAPTAIN'])
  @IsOptional()
  role?: string;
}
