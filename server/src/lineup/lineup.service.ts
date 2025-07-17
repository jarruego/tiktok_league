import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_PROVIDER } from '../database/database.module';
import { DatabaseService } from '../database/database.service';
import { lineupTable } from '../database/tables/lineup.table';
import { eq } from 'drizzle-orm';
import { SaveLineupDto } from './dto/save-lineup.dto';

@Injectable()
export class LineupService {
  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService
  ) {}

  async getLineup(teamId: number) {
    const db = this.databaseService.db;
    const [lineup] = await db.select().from(lineupTable).where(eq(lineupTable.teamId, teamId));
    return lineup || null;
  }

  async saveLineup(teamId: number, dto: SaveLineupDto) {
    const db = this.databaseService.db;
    const [existing] = await db.select().from(lineupTable).where(eq(lineupTable.teamId, teamId));
    if (existing) {
      await db.update(lineupTable)
        .set({ lineup: dto, updatedAt: new Date() })
        .where(eq(lineupTable.teamId, teamId));
      return { ...existing, lineup: dto };
    }
    const [created] = await db.insert(lineupTable)
      .values({ teamId, lineup: dto })
      .returning();
    return created;
  }
}
