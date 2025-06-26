import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ExternalPlayerDto {
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
  @IsOptional()
  role?: string;

  // Campos adicionales para APIs externas
  @IsInt()
  @IsOptional()
  id?: number; // ID del jugador en Football-Data.org

  @IsString()
  @IsOptional()
  externalId?: string; // ID del jugador en otras APIs

  @IsString()
  @IsOptional()
  marketValue?: string; // Valor de mercado

  @IsString()
  @IsOptional()
  contract?: string; // Hasta qué fecha tiene contrato
}

export class ImportPlayersDto {
  @IsInt()
  @IsNotEmpty()
  teamId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExternalPlayerDto)
  players: ExternalPlayerDto[];

  @IsString()
  @IsOptional()
  source?: string; // Fuente de datos (ej: 'football-data.org')
}
