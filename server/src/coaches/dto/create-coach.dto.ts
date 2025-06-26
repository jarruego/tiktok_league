import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class CreateCoachDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @IsOptional()
  footballDataId?: number;

  @IsString()
  @IsOptional()
  nationality?: string;

  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  contract?: string;
}
