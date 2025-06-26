import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { coachTable } from '../database/schema';
import { eq } from 'drizzle-orm';
import { CreateCoachDto } from './dto/create-coach.dto';
import { UpdateCoachDto } from './dto/update-coach.dto';
import { Inject } from '@nestjs/common';
import { DATABASE_PROVIDER } from '../database/database.module';

@Injectable()
export class CoachService {
  constructor(
    @Inject(DATABASE_PROVIDER)
    private readonly databaseService: DatabaseService,
  ) {}

  async create(createCoachDto: CreateCoachDto) {
    const db = this.databaseService.db;
    const [coach] = await db.insert(coachTable).values(createCoachDto).returning();
    return coach;
  }

  async findAll() {
    const db = this.databaseService.db;
    return db.select().from(coachTable);
  }

  async findOne(id: number) {
    const db = this.databaseService.db;
    const [coach] = await db.select().from(coachTable).where(eq(coachTable.id, id));
    if (!coach) throw new NotFoundException('Coach not found');
    return coach;
  }

  async findByFootballDataId(footballDataId: number) {
    const db = this.databaseService.db;
    const [coach] = await db.select().from(coachTable).where(eq(coachTable.footballDataId, footballDataId));
    return coach;
  }

  async update(id: number, updateCoachDto: UpdateCoachDto) {
    const db = this.databaseService.db;
    const [coach] = await db
      .update(coachTable)
      .set({ ...updateCoachDto, updatedAt: new Date() })
      .where(eq(coachTable.id, id))
      .returning();
    if (!coach) throw new NotFoundException('Coach not found');
    return coach;
  }

  async remove(id: number) {
    const db = this.databaseService.db;
    const [coach] = await db
      .delete(coachTable)
      .where(eq(coachTable.id, id))
      .returning();
    if (!coach) throw new NotFoundException('Coach not found');
    return coach;
  }

  async createOrUpdate(coachData: CreateCoachDto) {
    const db = this.databaseService.db;
    
    // Validar que el nombre del entrenador no sea null o undefined
    if (!coachData.name || coachData.name.trim() === '') {
      throw new Error('Coach name is required and cannot be empty');
    }
    
    if (coachData.footballDataId) {
      // Intentar encontrar entrenador existente
      const existingCoach = await this.findByFootballDataId(coachData.footballDataId);
      
      if (existingCoach) {
        // Actualizar entrenador existente
        return this.update(existingCoach.id, coachData);
      }
    }
    
    // Crear nuevo entrenador
    return this.create(coachData);
  }

  async createOrUpdateSafely(coachData: CreateCoachDto): Promise<any | null> {
    try {
      // Validar que los datos mínimos estén presentes
      if (!coachData.name || coachData.name.trim() === '') {
        console.warn('Skipping coach creation: name is missing or empty');
        return null;
      }

      return await this.createOrUpdate(coachData);
    } catch (error) {
      console.error('Error creating/updating coach:', error);
      return null;
    }
  }
}
