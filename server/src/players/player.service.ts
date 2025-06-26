import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { playerTable, teamTable } from '../database/schema';
import { eq, and, inArray, SQL } from 'drizzle-orm';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { GetPlayersQueryDto } from './dto/get-players-query.dto';
import { ImportPlayersDto, ExternalPlayerDto } from './dto/import-players.dto';
import { FootballDataTeamResponseDto, ImportTeamFromFootballDataDto } from './dto/football-data.dto';
import { TeamService } from '../teams/team.service';
import { Inject } from '@nestjs/common';
import { DATABASE_PROVIDER } from '../database/database.module';

@Injectable()
export class PlayerService {
  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
    private readonly teamService: TeamService,
  ) {}

  async create(createPlayerDto: CreatePlayerDto) {
    const db = this.databaseService.db;
    
    // Verificar que el equipo existe
    const [team] = await db.select().from(teamTable).where(eq(teamTable.id, createPlayerDto.teamId));
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Verificar que no haya otro jugador con el mismo número de camiseta en el equipo
    if (createPlayerDto.shirtNumber) {
      const [existingPlayer] = await db
        .select()
        .from(playerTable)
        .where(
          and(
            eq(playerTable.teamId, createPlayerDto.teamId),
            eq(playerTable.shirtNumber, createPlayerDto.shirtNumber)
          )
        );
      
      if (existingPlayer) {
        throw new ConflictException('Shirt number already taken in this team');
      }
    }

    const [player] = await db.insert(playerTable).values(createPlayerDto).returning();
    return player;
  }

  async findAll(query: GetPlayersQueryDto = {}) {
    const db = this.databaseService.db;
    
    let whereConditions: SQL[] = [];
    
    if (query.teamId) {
      whereConditions.push(eq(playerTable.teamId, query.teamId));
    }
    
    if (query.position) {
      whereConditions.push(eq(playerTable.position, query.position));
    }
    
    if (query.nationality) {
      whereConditions.push(eq(playerTable.nationality, query.nationality));
    }
    
    if (query.role) {
      whereConditions.push(eq(playerTable.role, query.role));
    }

    const queryBuilder = db
      .select({
        id: playerTable.id,
        name: playerTable.name,
        position: playerTable.position,
        dateOfBirth: playerTable.dateOfBirth,
        nationality: playerTable.nationality,
        shirtNumber: playerTable.shirtNumber,
        role: playerTable.role,
        createdAt: playerTable.createdAt,
        updatedAt: playerTable.updatedAt,
        team: {
          id: teamTable.id,
          name: teamTable.name,
          displayName: teamTable.displayName,
        }
      })
      .from(playerTable)
      .leftJoin(teamTable, eq(playerTable.teamId, teamTable.id));

    if (whereConditions.length > 0) {
      queryBuilder.where(and(...whereConditions));
    }

    return queryBuilder;
  }

  async findOne(id: number) {
    const db = this.databaseService.db;
    
    const [player] = await db
      .select({
        id: playerTable.id,
        name: playerTable.name,
        position: playerTable.position,
        dateOfBirth: playerTable.dateOfBirth,
        nationality: playerTable.nationality,
        shirtNumber: playerTable.shirtNumber,
        role: playerTable.role,
        createdAt: playerTable.createdAt,
        updatedAt: playerTable.updatedAt,
        team: {
          id: teamTable.id,
          name: teamTable.name,
          displayName: teamTable.displayName,
        }
      })
      .from(playerTable)
      .leftJoin(teamTable, eq(playerTable.teamId, teamTable.id))
      .where(eq(playerTable.id, id));
    
    if (!player) {
      throw new NotFoundException('Player not found');
    }
    
    return player;
  }

  async findByTeam(teamId: number) {
    const db = this.databaseService.db;
    
    // Verificar que el equipo existe
    const [team] = await db.select().from(teamTable).where(eq(teamTable.id, teamId));
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return db
      .select()
      .from(playerTable)
      .where(eq(playerTable.teamId, teamId));
  }

  async update(id: number, updatePlayerDto: UpdatePlayerDto) {
    const db = this.databaseService.db;
    
    // Verificar que el jugador existe
    const [existingPlayer] = await db.select().from(playerTable).where(eq(playerTable.id, id));
    if (!existingPlayer) {
      throw new NotFoundException('Player not found');
    }

    // Si se está actualizando el equipo, verificar que existe
    if (updatePlayerDto.teamId) {
      const [team] = await db.select().from(teamTable).where(eq(teamTable.id, updatePlayerDto.teamId));
      if (!team) {
        throw new NotFoundException('Team not found');
      }
    }

    // Verificar conflicto de número de camiseta
    if (updatePlayerDto.shirtNumber) {
      const teamIdToCheck = updatePlayerDto.teamId || existingPlayer.teamId;
      const [conflictingPlayer] = await db
        .select()
        .from(playerTable)
        .where(
          and(
            eq(playerTable.teamId, teamIdToCheck),
            eq(playerTable.shirtNumber, updatePlayerDto.shirtNumber),
            // Excluir el jugador actual
            eq(playerTable.id, id)
          )
        );
      
      if (conflictingPlayer && conflictingPlayer.id !== id) {
        throw new ConflictException('Shirt number already taken in this team');
      }
    }

    const [player] = await db
      .update(playerTable)
      .set({ ...updatePlayerDto, updatedAt: new Date() })
      .where(eq(playerTable.id, id))
      .returning();
    
    return player;
  }

  async remove(id: number) {
    const db = this.databaseService.db;
    
    const [player] = await db
      .delete(playerTable)
      .where(eq(playerTable.id, id))
      .returning();
    
    if (!player) {
      throw new NotFoundException('Player not found');
    }
    
    return player;
  }

  async createMany(createPlayersDto: CreatePlayerDto[]) {
    const db = this.databaseService.db;
    
    // Verificar que todos los equipos existen
    const teamIds = [...new Set(createPlayersDto.map(p => p.teamId))];
    const teams = await db.select().from(teamTable).where(inArray(teamTable.id, teamIds));
    
    if (teams.length !== teamIds.length) {
      throw new NotFoundException('One or more teams not found');
    }

    // Insertar jugadores en lote
    const players = await db.insert(playerTable).values(createPlayersDto).returning();
    return players;
  }

  async importPlayersFromExternal(importPlayersDto: ImportPlayersDto) {
    const db = this.databaseService.db;
    
    // Verificar que el equipo existe
    const [team] = await db.select().from(teamTable).where(eq(teamTable.id, importPlayersDto.teamId));
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Convertir jugadores externos a DTOs internos
    const createPlayersDto: CreatePlayerDto[] = importPlayersDto.players.map((externalPlayer: ExternalPlayerDto) => ({
      teamId: importPlayersDto.teamId,
      name: externalPlayer.name,
      position: externalPlayer.position,
      dateOfBirth: externalPlayer.dateOfBirth,
      nationality: externalPlayer.nationality,
      shirtNumber: externalPlayer.shirtNumber,
      role: externalPlayer.role || 'PLAYER',
    }));

    // Obtener jugadores actuales del equipo para evitar duplicados
    const existingPlayers = await db
      .select()
      .from(playerTable)
      .where(eq(playerTable.teamId, importPlayersDto.teamId));

    // Filtrar jugadores que ya existen (por nombre y equipo)
    const newPlayers = createPlayersDto.filter(newPlayer => 
      !existingPlayers.some(existing => 
        existing.name.toLowerCase() === newPlayer.name.toLowerCase()
      )
    );

    if (newPlayers.length === 0) {
      return { message: 'No new players to import', imported: 0 };
    }

    // Insertar jugadores nuevos
    const players = await db.insert(playerTable).values(newPlayers).returning();
    
    return {
      message: `Successfully imported ${players.length} players`,
      imported: players.length,
      players: players,
      source: importPlayersDto.source || 'external'
    };
  }

  async importFromFootballData(
    teamData: FootballDataTeamResponseDto,
    importDto: ImportTeamFromFootballDataDto
  ) {
    const db = this.databaseService.db;
    
    // Verificar que el equipo existe en nuestra base de datos
    const [team] = await db.select().from(teamTable).where(eq(teamTable.id, importDto.teamId));
    if (!team) {
      throw new NotFoundException('Team not found in database');
    }

    // 1. Actualizar información del equipo y entrenador
    const teamUpdateResult = await this.teamService.updateWithFootballData(importDto.teamId, teamData);

    // 2. Convertir jugadores de Football-Data a nuestro formato
    const createPlayersDto: CreatePlayerDto[] = teamData.squad.map(player => ({
      teamId: importDto.teamId,
      name: player.name,
      position: player.position,
      dateOfBirth: player.dateOfBirth,
      nationality: player.nationality,
      shirtNumber: player.shirtNumber,
      role: player.role || 'PLAYER',
    }));

    // 3. Obtener jugadores actuales del equipo
    const existingPlayers = await db
      .select()
      .from(playerTable)
      .where(eq(playerTable.teamId, importDto.teamId));

    // 4. Filtrar jugadores que ya existen (por nombre)
    const newPlayers = createPlayersDto.filter(newPlayer => 
      !existingPlayers.some(existing => 
        existing.name.toLowerCase().trim() === newPlayer.name.toLowerCase().trim()
      )
    );

    if (newPlayers.length === 0) {
      return { 
        message: 'Team information updated, but no new players to import', 
        imported: 0,
        teamInfo: {
          name: teamData.name,
          venue: teamData.venue,
          founded: teamData.founded,
          coach: teamData.coach?.name,
          updated: true
        },
        teamUpdateResult: teamUpdateResult
      };
    }

    // 5. Manejar conflictos de números de camiseta
    const playersToImport: CreatePlayerDto[] = [];
    const conflictingNumbers: Array<{
      playerName: string;
      number: number;
      conflictWith: string;
    }> = [];

    for (const player of newPlayers) {
      if (player.shirtNumber) {
        const existingWithNumber = existingPlayers.find(
          existing => existing.shirtNumber === player.shirtNumber
        );
        
        if (existingWithNumber) {
          // Si hay conflicto, importar sin número de camiseta
          conflictingNumbers.push({
            playerName: player.name,
            number: player.shirtNumber,
            conflictWith: existingWithNumber.name
          });
          playersToImport.push({ ...player, shirtNumber: undefined });
        } else {
          playersToImport.push(player);
        }
      } else {
        playersToImport.push(player);
      }
    }

    // 6. Insertar jugadores nuevos
    const players = await db.insert(playerTable).values(playersToImport).returning();

    return {
      message: `Successfully imported ${players.length} players and updated team information from Football-Data.org`,
      imported: players.length,
      players: players,
      teamInfo: {
        name: teamData.name,
        venue: teamData.venue,
        founded: teamData.founded,
        coach: teamData.coach?.name,
        updated: true
      },
      teamUpdateResult: teamUpdateResult,
      conflicts: conflictingNumbers.length > 0 ? {
        message: 'Some players were imported without shirt numbers due to conflicts',
        details: conflictingNumbers
      } : null,
      source: 'football-data.org'
    };
  }
}
