import { Injectable, Inject } from '@nestjs/common';
import { userTable } from '../database/tables/user.table';
import * as schema from '../database/schema';
import { inArray, and } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { eq } from 'drizzle-orm';
import { DATABASE_PROVIDER } from '../database/database.module';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
  ) {}

  // Busca un usuario por username en la base de datos
  async findByUsername(username: string) {
    const db = this.databaseService.db;
    const [user] = await db.select().from(userTable).where(eq(userTable.username, username));
    return user;
  }

  // Crea un usuario a partir de los datos de TikTok, permite asignar teamId
  async createFromTikTok({ username, displayName, avatar, teamId }: { username: string; displayName?: string; avatar?: string; teamId?: number }) {
    const db = this.databaseService.db;
    // Si no se pasa teamId, buscar el equipo bot más alto y asignarlo aquí
    let finalTeamId = teamId;
    if (!finalTeamId) {
      for (let division = 1; division <= 5; division++) {
        const botTeams = await this.findBotTeamsByDivision(division);
        if (Array.isArray(botTeams) && botTeams.length > 0 && botTeams[0]?.id) {
          finalTeamId = botTeams[0].id;
          // Actualizar el equipo bot: isBot=false y nombre=usuario TikTok
          await this.updateTeamBotAssignment({
            teamId: botTeams[0].id,
            isBot: false,
            name: username
          });
          break;
        }
      }
    }
    const [user] = await db.insert(userTable).values({
      username,
      displayName: displayName || null,
      avatar: avatar || null,
      provider: 'tiktok',
      role: 'user', // rol por defecto
      password: '', // sin password local
      teamId: finalTeamId || null
    }).returning();
    return user;
  }
  // Busca equipos is_bot=1 en la división dada, ordenados por seguidores descendente
  async findBotTeamsByDivision(division: number) {
    const db = this.databaseService.db;
    // Buscar ligas en la división
    const leagues = await db.select().from(schema.leagueTable).where(eq(schema.leagueTable.divisionId, division));
    if (!leagues || leagues.length === 0) return [];
    const leagueIds = leagues.map(l => l.id);
    // Buscar asignaciones de equipos en esas ligas
    const assignments = await db.select().from(schema.teamLeagueAssignmentTable)
      .where(inArray(schema.teamLeagueAssignmentTable.leagueId, leagueIds));
    if (!assignments || assignments.length === 0) return [];
    const teamIds = assignments.map(a => a.teamId);
    // Buscar equipos is_bot=1 entre esos teamIds, ordenados por followers descendente
    const teams = await db.select().from(schema.teamTable)
      .where(and(inArray(schema.teamTable.id, teamIds), eq(schema.teamTable.isBot, 1)))
      .orderBy(schema.teamTable.followers);
    // Orden descendente followers
    return teams.reverse();
  }

  // Actualiza el equipo: isBot y nombre
  async updateTeamBotAssignment({ teamId, isBot, name }: { teamId: number; isBot: boolean | number; name: string }) {
    const db = this.databaseService.db;
    await db.update(schema.teamTable)
      .set({ isBot: isBot ? 1 : 0, name })
      .where(eq(schema.teamTable.id, teamId));
  }

  // Crea un usuario a partir de los datos de Google
  async createFromGoogle({ username, displayName, avatar }: { username: string; displayName?: string; avatar?: string }) {
    const db = this.databaseService.db;
    const [user] = await db.insert(userTable).values({
      username,
      displayName: displayName || null,
      avatar: avatar || null,
      provider: 'google',
      role: 'user',
      password: '',
    }).returning();
    return user;
  }

  // Crea un usuario a partir del registro clásico
  async createFromRegister({ username, password, email }: { username: string; password: string; email?: string }) {
    const db = this.databaseService.db;
    const [user] = await db.insert(userTable).values({
      username,
      password,
      email: email || null,
      provider: 'local',
      role: 'user',
    }).returning();
    return user;
  }
}
