import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { teamTable } from '../database/schema';
import { eq } from 'drizzle-orm';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { Inject } from '@nestjs/common';
import { DATABASE_PROVIDER } from '../database/database.module';

@Injectable()
export class TeamService {
  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
  ) {}

  async create(createTeamDto: CreateTeamDto) {
    const db = this.databaseService.db;
    const [team] = await db.insert(teamTable).values(createTeamDto).returning();
    return team;
  }

  async findAll() {
    const db = this.databaseService.db;
    return db.select().from(teamTable);
  }

  async findOne(id: number) {
    const db = this.databaseService.db;
    const [team] = await db.select().from(teamTable).where(eq(teamTable.id, id));
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async update(id: number, updateTeamDto: UpdateTeamDto) {
    const db = this.databaseService.db;
    const [team] = await db
      .update(teamTable)
      .set(updateTeamDto)
      .where(eq(teamTable.id, id))
      .returning();
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async remove(id: number) {
    const db = this.databaseService.db;
    const [team] = await db
      .delete(teamTable)
      .where(eq(teamTable.id, id))
      .returning();
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }
}
