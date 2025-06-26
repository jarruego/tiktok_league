import { IsString, IsInt, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class CreateSeasonDto {
  @IsString()
  name: string;

  @IsInt()
  year: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean = false;
}
