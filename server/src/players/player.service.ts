import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { playerTable, teamTable } from '../database/schema';
import { eq, and, inArray, SQL, sql } from 'drizzle-orm';
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
    
    // Verificar que el equipo existe (solo si teamId no es null)
    if (createPlayerDto.teamId) {
      const [team] = await db.select().from(teamTable).where(eq(teamTable.id, createPlayerDto.teamId));
      if (!team) {
        throw new NotFoundException('Team not found');
      }
    }

    // Verificar que no haya otro jugador con el mismo número de camiseta en el equipo
    if (createPlayerDto.shirtNumber && createPlayerDto.teamId) {
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
          crest: teamTable.crest,
          avatarUrl: teamTable.avatarUrl,
          primaryColor: teamTable.primaryColor,
          secondaryColor: teamTable.secondaryColor,
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
      if (teamIdToCheck) { // Solo verificar si hay un teamId válido
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
    
    // Verificar que todos los equipos existen (filtrar valores null/undefined)
    const teamIds = [...new Set(createPlayersDto.map(p => p.teamId).filter((id): id is number => id !== null && id !== undefined))];
    
    if (teamIds.length > 0) {
      const teams = await db.select().from(teamTable).where(inArray(teamTable.id, teamIds));
      
      if (teams.length !== teamIds.length) {
        throw new NotFoundException('One or more teams not found');
      }
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
    const teamUpdateResult = await this.teamService.updateWithFootballData(
      importDto.teamId, 
      teamData, 
      importDto.competitionId
    );

    // Si no hay jugadores en el cache, solo actualizar datos generales y NO tocar plantilla
    if (!Array.isArray(teamData.squad) || teamData.squad.length === 0) {
      return {
        message: 'No se encontraron jugadores en el cache para este equipo. Solo se actualizaron los datos generales.',
        teamInfo: {
          name: teamData.name,
          venue: teamData.venue,
          founded: teamData.founded,
          coach: teamData.coach?.name,
          updated: true
        },
        teamUpdateResult: teamUpdateResult,
        synchronization: {
          summary: {
            total: 0,
            added: 0,
            updated: 0,
            departed: 0,
            unchanged: 0,
            manualPlayers: 0
          },
          details: {}
        },
        source: 'football-data.org-sync-no-squad'
      };
    }

    // 2. Convertir jugadores de Football-Data a nuestro formato con footballDataId
    const incomingPlayers = teamData.squad.map(player => ({
      teamId: importDto.teamId,
      name: player.name,
      position: player.position,
      dateOfBirth: player.dateOfBirth,
      nationality: player.nationality,
      shirtNumber: player.shirtNumber,
      role: player.role || 'PLAYER',
      footballDataId: player.id // IMPORTANTE: Guardar el ID de Football-Data
    }));

    // 3. Obtener jugadores actuales del equipo con footballDataId
    const existingPlayers = await db
      .select()
      .from(playerTable)
      .where(eq(playerTable.teamId, importDto.teamId));

    // 4. NUEVA LÓGICA: Sincronización completa
    const syncResults = {
      added: [] as any[],
      updated: [] as any[],
      departed: [] as any[], // Jugadores que ya no están en el equipo
      unchanged: [] as any[]
    };

    // Crear mapas para facilitar las comparaciones
    const incomingPlayersMap = new Map(
      incomingPlayers.map(p => [p.footballDataId, p])
    );
    const existingPlayersMap = new Map(
      existingPlayers
        .filter(p => p.footballDataId) // Solo jugadores con footballDataId
        .map(p => [p.footballDataId, p])
    );

    // A. Detectar jugadores que ya no están en el equipo (BAJAS/TRANSFERENCIAS)
    for (const existingPlayer of existingPlayers) {
      if (existingPlayer.footballDataId && !incomingPlayersMap.has(existingPlayer.footballDataId)) {
        // Este jugador ya no está en la plantilla según Football-Data
        await db
          .update(playerTable)
          .set({ 
            teamId: null, // Dejar teamId en null (transferido/liberado)
            updatedAt: new Date() 
          })
          .where(eq(playerTable.id, existingPlayer.id));
        
        syncResults.departed.push({
          id: existingPlayer.id,
          name: existingPlayer.name,
          footballDataId: existingPlayer.footballDataId,
          action: 'departed'
        });
      }
    }

    // B. Procesar jugadores actuales de Football-Data
    for (const incomingPlayer of incomingPlayers) {
      const existingPlayer = existingPlayersMap.get(incomingPlayer.footballDataId);

      if (!existingPlayer) {
        // NUEVO JUGADOR: No existe en nuestra BD
        // Verificar si el jugador existe en otra parte (por footballDataId)
        const [playerInOtherTeam] = await db
          .select()
          .from(playerTable)
          .where(eq(playerTable.footballDataId, incomingPlayer.footballDataId));

        if (playerInOtherTeam) {
          // TRANSFERENCIA: Jugador venía de otro equipo
          await db
            .update(playerTable)
            .set({ 
              teamId: importDto.teamId,
              position: incomingPlayer.position,
              shirtNumber: incomingPlayer.shirtNumber,
              role: incomingPlayer.role,
              updatedAt: new Date()
            })
            .where(eq(playerTable.id, playerInOtherTeam.id));

          syncResults.added.push({
            id: playerInOtherTeam.id,
            name: incomingPlayer.name,
            footballDataId: incomingPlayer.footballDataId,
            action: 'transferred_in',
            previousTeamId: playerInOtherTeam.teamId
          });
        } else {
          // FICHAJE NUEVO: Crear nuevo jugador
          const [newPlayer] = await db
            .insert(playerTable)
            .values(incomingPlayer)
            .returning();

          syncResults.added.push({
            id: newPlayer.id,
            name: newPlayer.name,
            footballDataId: newPlayer.footballDataId,
            action: 'new_signing'
          });
        }
      } else {
        // JUGADOR EXISTENTE: Actualizar datos si han cambiado
        const hasChanges = 
          existingPlayer.position !== incomingPlayer.position ||
          existingPlayer.shirtNumber !== incomingPlayer.shirtNumber ||
          existingPlayer.role !== incomingPlayer.role;

        if (hasChanges) {
          await db
            .update(playerTable)
            .set({
              position: incomingPlayer.position,
              shirtNumber: incomingPlayer.shirtNumber,
              role: incomingPlayer.role,
              updatedAt: new Date()
            })
            .where(eq(playerTable.id, existingPlayer.id));

          syncResults.updated.push({
            id: existingPlayer.id,
            name: existingPlayer.name,
            footballDataId: existingPlayer.footballDataId,
            action: 'updated',
            changes: {
              position: { from: existingPlayer.position, to: incomingPlayer.position },
              shirtNumber: { from: existingPlayer.shirtNumber, to: incomingPlayer.shirtNumber },
              role: { from: existingPlayer.role, to: incomingPlayer.role }
            }
          });
        } else {
          syncResults.unchanged.push({
            id: existingPlayer.id,
            name: existingPlayer.name,
            footballDataId: existingPlayer.footballDataId,
            action: 'unchanged'
          });
        }
      }
    }

    // C. Manejar jugadores sin footballDataId (importados manualmente)
    const playersWithoutFootballDataId = existingPlayers.filter(p => !p.footballDataId);
    
    return {
      message: `Squad synchronization completed: ${syncResults.added.length} added, ${syncResults.updated.length} updated, ${syncResults.departed.length} departed`,
      teamInfo: {
        name: teamData.name,
        venue: teamData.venue,
        founded: teamData.founded,
        coach: teamData.coach?.name,
        updated: true
      },
      teamUpdateResult: teamUpdateResult,
      synchronization: {
        summary: {
          total: incomingPlayers.length,
          added: syncResults.added.length,
          updated: syncResults.updated.length,
          departed: syncResults.departed.length,
          unchanged: syncResults.unchanged.length,
          manualPlayers: playersWithoutFootballDataId.length
        },
        details: syncResults
      },
      source: 'football-data.org-sync'
    };
  }

  /**
   * Obtiene todos los equipos que tienen footballDataId y competitionId configurados
   */
  async getTeamsWithFootballDataConfig() {
    const db = this.databaseService.db;
    
    return await db
      .select({
        id: teamTable.id,
        name: teamTable.name,
        shortName: teamTable.shortName,
        footballDataId: teamTable.footballDataId,
        competitionId: teamTable.competitionId,
        tiktokId: teamTable.tiktokId,
        followers: teamTable.followers
      })
      .from(teamTable)
      .where(
        sql`${teamTable.footballDataId} IS NOT NULL AND ${teamTable.competitionId} IS NOT NULL`
      )
      .orderBy(teamTable.name);
  }
}
