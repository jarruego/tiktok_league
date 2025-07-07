import { PartialType } from '@nestjs/mapped-types';
import { CreateMatchDto } from './create-match.dto';
import { IsOptional, IsInt, IsString, IsIn } from 'class-validator';
import { MatchStatus } from '../../database/schema';

export class UpdateMatchDto extends PartialType(CreateMatchDto) {
  @IsOptional()
  @IsIn(Object.values(MatchStatus))
  status?: string;

  @IsOptional()
  @IsInt()
  homeGoals?: number;

  @IsOptional()
  @IsInt()
  awayGoals?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
