import { IsArray, IsString } from 'class-validator';

export class SaveLineupDto {
  @IsArray()
  @IsString({ each: true })
  Goalkeeper: string[];

  @IsArray()
  @IsString({ each: true })
  Defence: string[];

  @IsArray()
  @IsString({ each: true })
  Midfield: string[];

  @IsArray()
  @IsString({ each: true })
  Forward: string[];
}
