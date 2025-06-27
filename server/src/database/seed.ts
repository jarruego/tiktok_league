import { eq } from 'drizzle-orm';
import { teamTable } from './tables/team.table';
import { userTable } from './tables/user.table';
import { DatabaseService } from './database.service';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

// Ejemplo de cuentas famosas de TikTok asociadas a equipos
const teams = [
  { name: 'Team PSG', tiktokId: 'psg', followers: 0 },
  { name: 'Team Real Madrid', tiktokId: 'realmadrid', followers: 0 },
  { name: 'Team Liverpool', tiktokId: 'liverpoolfc', followers: 0 },
];

async function seed() {
  const databaseUrl = process.env.DATABASE_URL as string;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not defined');
  }
  const dbInstance = drizzle(databaseUrl);
  const databaseService = new DatabaseService(dbInstance);
  const db = databaseService.db;

  // Crear usuario admin por defecto
  try {
    const existingAdmin = await db.select().from(userTable).where(eq(userTable.username, 'admin'));
    if (existingAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await db.insert(userTable).values({
        username: 'admin',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('Usuario admin creado con credenciales: admin/admin123');
    } else {
      console.log('Usuario admin ya existe');
    }
  } catch (error) {
    console.log('Error creando usuario admin (tabla puede no existir aún):', error.message);
  }

  // Crear usuario moderador
  try {
    const existingModerator = await db.select().from(userTable).where(eq(userTable.username, 'moderador'));
    if (existingModerator.length === 0) {
      const hashedPassword = await bcrypt.hash('mod123', 10);
      await db.insert(userTable).values({
        username: 'moderador',
        password: hashedPassword,
        role: 'moderator'
      });
      console.log('Usuario moderador creado con credenciales: moderador/mod123');
    } else {
      console.log('Usuario moderador ya existe');
    }
  } catch (error) {
    console.log('Error creando usuario moderador:', error.message);
  }

  // Crear usuario normal
  try {
    const existingUser = await db.select().from(userTable).where(eq(userTable.username, 'usuario'));
    if (existingUser.length === 0) {
      const hashedPassword = await bcrypt.hash('user123', 10);
      await db.insert(userTable).values({
        username: 'usuario',
        password: hashedPassword,
        role: 'user'
      });
      console.log('Usuario normal creado con credenciales: usuario/user123');
    } else {
      console.log('Usuario normal ya existe');
    }
  } catch (error) {
    console.log('Error creando usuario normal:', error.message);
  }

  // Crear equipos de ejemplo

  for (const team of teams) {
    // Verifica si el equipo ya existe por tiktokId
    const exists = await db.select().from(teamTable).where(eq(teamTable.tiktokId, team.tiktokId));
    if (exists.length === 0) {
      await db.insert(teamTable).values(team);
      console.log(`Equipo insertado: ${team.name}`);
    } else {
      console.log(`Ya existe: ${team.name}`);
    }
  }
  console.log('Seed finalizado.');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
