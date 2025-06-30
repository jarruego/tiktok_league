import { Injectable, Inject } from '@nestjs/common';
import { userTable } from '../database/tables/user.table';
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

  // Crea un usuario a partir de los datos de TikTok
  async createFromTikTok({ username, displayName, avatar }: { username: string; displayName?: string; avatar?: string }) {
    const db = this.databaseService.db;
    const [user] = await db.insert(userTable).values({
      username,
      displayName: displayName || null,
      avatar: avatar || null,
      provider: 'tiktok',
      role: 'user', // rol por defecto
      password: '', // sin password local
    }).returning();
    return user;
  }
}
