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
}
