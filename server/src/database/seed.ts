import { eq } from 'drizzle-orm';
import { teamTable } from './tables/team.table';
import { userTable } from './tables/user.table';
import { DatabaseService } from './database.service';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

// Equipos extraídos de la base de datos con todos sus datos completos
const teams = [
  {
    "name": "Manchester City",
    "tiktokId": "mancity",
    "followers": 31800000,
    "displayName": "mancity",
    "footballDataId": 65,
    "competitionId": 2021
  },
  {
    "name": "Liverpool FC",
    "tiktokId": "liverpoolfc",
    "followers": 26200000,
    "displayName": "liverpoolfc",
    "footballDataId": 64,
    "competitionId": 2021
  },
  {
    "name": "Fútbol Club Barcelona",
    "tiktokId": "fcbarcelona",
    "followers": 57900000,
    "displayName": "fcbarcelona",
    "footballDataId": 81,
    "competitionId": 2014
  },
  {
    "name": "Chelsea FC",
    "tiktokId": "chelseafc",
    "followers": 19200000,
    "displayName": "chelseafc",
    "footballDataId": 61,
    "competitionId": 2021
  },
  {
    "name": "Olympique de Marseille",
    "tiktokId": "om",
    "followers": 5000000,
    "displayName": "om",
    "footballDataId": 516,
    "competitionId": 2015
  },
  {
    "name": "AFC Ajax",
    "tiktokId": "afcajax",
    "followers": 10000000,
    "displayName": "afcajax",
    "footballDataId": 678,
    "competitionId": 2003
  },
  {
    "name": "Tottenham Hotspur",
    "tiktokId": "spursofficial",
    "followers": 41400000,
    "displayName": "spursofficial",
    "footballDataId": 73,
    "competitionId": 2021
  },
  {
    "name": "SL Benfica",
    "tiktokId": "slbenfica",
    "followers": 2500000,
    "displayName": "slbenfica",
    "footballDataId": 1903,
    "competitionId": 2017
  },
  {
    "name": "FC Bayern",
    "tiktokId": "fcbayern",
    "followers": 24300000,
    "displayName": "fcbayern",
    "footballDataId": 5,
    "competitionId": 2002
  },
  {
    "name": "Lille OSC",
    "tiktokId": "losc",
    "followers": 2900000,
    "displayName": "losc",
    "footballDataId": 521,
    "competitionId": 2015
  },
  {
    "name": "Napoli",
    "tiktokId": "sscnapoli",
    "followers": 6200000,
    "displayName": "sscnapoli",
    "footballDataId": 113,
    "competitionId": 2019
  },
  {
    "name": "AS Monaco",
    "tiktokId": "asmonaco",
    "followers": 6600000,
    "displayName": "asmonaco",
    "footballDataId": 548,
    "competitionId": 2015
  },
  {
    "name": "Bayer Leverkusen",
    "tiktokId": "bayer04",
    "followers": 5100000,
    "displayName": "bayer04",
    "footballDataId": 3,
    "competitionId": 2002
  },
  {
    "name": "Inter de Milan",
    "tiktokId": "inter",
    "followers": 16600000,
    "displayName": "inter",
    "footballDataId": 108,
    "competitionId": 2019
  },
  {
    "name": "AS Roma",
    "tiktokId": "asroma",
    "followers": 16000000,
    "displayName": "asroma",
    "footballDataId": 100,
    "competitionId": 2019
  },
  {
    "name": "Atalanta BC",
    "tiktokId": "atalanta_bc",
    "followers": 1200000,
    "displayName": "atalanta_bc",
    "footballDataId": 102,
    "competitionId": 2019
  },
  {
    "name": "Juventus",
    "tiktokId": "juventus",
    "followers": 40100000,
    "displayName": "juventus",
    "footballDataId": 109,
    "competitionId": 2019
  },
  {
    "name": "Eintracht Frankfurt",
    "tiktokId": "eintracht",
    "followers": 1700000,
    "displayName": "eintracht",
    "footballDataId": 19,
    "competitionId": 2002
  },
  {
    "name": "Olympique Lyonnais",
    "tiktokId": "ol_officiel",
    "followers": 2100000,
    "displayName": "ol_officiel",
    "footballDataId": 523,
    "competitionId": 2015
  },
  {
    "name": "Manchester United",
    "tiktokId": "manutd",
    "followers": 29500000,
    "displayName": "manutd",
    "footballDataId": 66,
    "competitionId": 2021
  },
  {
    "name": "West Ham United FC",
    "tiktokId": "westham",
    "followers": 6700000,
    "displayName": "westham",
    "footballDataId": 563,
    "competitionId": 2021
  },
  {
    "name": "AC Milan",
    "tiktokId": "acmilan",
    "followers": 20800000,
    "displayName": "acmilan",
    "footballDataId": 98,
    "competitionId": 2019
  },
  {
    "name": "Arsenal",
    "tiktokId": "arsenal",
    "followers": 9700000,
    "displayName": "arsenal",
    "footballDataId": 57,
    "competitionId": 2021
  },
  {
    "name": "Athletic Club",
    "tiktokId": "athleticclub",
    "followers": 8700000,
    "displayName": "athleticclub",
    "footballDataId": 77,
    "competitionId": 2014
  },
  {
    "name": "Villarreal CF",
    "tiktokId": "villarrealcf",
    "followers": 3400000,
    "displayName": "villarrealcf",
    "footballDataId": 94,
    "competitionId": 2014
  },
  {
    "name": "FC Porto",
    "tiktokId": "fcporto",
    "followers": 2500000,
    "displayName": "fcporto",
    "footballDataId": 503,
    "competitionId": 2017
  },
  {
    "name": "Real Oviedo",
    "tiktokId": "realoviedo",
    "followers": 2000000,
    "displayName": "realoviedo",
    "footballDataId": 1048,
    "competitionId": 2014
  },
  {
    "name": "Team PSG",
    "tiktokId": "psg",
    "followers": 48200000,
    "displayName": "psg",
    "footballDataId": 524,
    "competitionId": 2015
  },
  {
    "name": "Atlético de Madrid",
    "tiktokId": "atleticodemadrid",
    "followers": 28100000,
    "displayName": "atleticodemadrid",
    "footballDataId": 78,
    "competitionId": 2014
  },
  {
    "name": "ACF Fiorentina",
    "tiktokId": "acffiorentina",
    "followers": 1100000,
    "displayName": "acffiorentina",
    "footballDataId": 99,
    "competitionId": 2019
  },
  {
    "name": "Aston Villa FC",
    "tiktokId": "avfcofficial",
    "followers": 4400000,
    "displayName": "avfcofficial",
    "footballDataId": 58,
    "competitionId": 2021
  },
  {
    "name": "Real Betis Balompié",
    "tiktokId": "realbetisbalompie",
    "followers": 11200000,
    "displayName": "realbetisbalompie",
    "footballDataId": 90,
    "competitionId": 2014
  },
  {
    "name": "Sevilla FC",
    "tiktokId": "sevillafc",
    "followers": 10500000,
    "displayName": "sevillafc",
    "footballDataId": 559,
    "competitionId": 2014
  },
  {
    "name": "Valencia CF",
    "tiktokId": "valenciacf",
    "followers": 8200000,
    "displayName": "valenciacf",
    "footballDataId": 95,
    "competitionId": 2014
  },
  {
    "name": "Sporting CP",
    "tiktokId": "sporting_cp",
    "followers": 4000000,
    "displayName": "sporting_cp",
    "footballDataId": 498,
    "competitionId": 2017
  },
  {
    "name": "Real Sociedad",
    "tiktokId": "realsociedad",
    "followers": 15700000,
    "displayName": "realsociedad",
    "footballDataId": 92,
    "competitionId": 2014
  },
  {
    "name": "PSV Eindhoven",
    "tiktokId": "psv",
    "followers": 2100000,
    "displayName": "psv",
    "footballDataId": 674,
    "competitionId": 2003
  },
  {
    "name": "Borussia Dortmund",
    "tiktokId": "bvb",
    "followers": 16400000,
    "displayName": "bvb",
    "footballDataId": 4,
    "competitionId": 2002
  },
  {
    "name": "Feyenoord Rotterdam",
    "tiktokId": "feyenoord",
    "followers": 2100000,
    "displayName": "feyenoord",
    "footballDataId": 675,
    "competitionId": 2003
  },

  {
    "name": "Real Madrid",
    "tiktokId": "realmadrid",
    "followers": 63400000,
    "displayName": "realmadrid",
    "footballDataId": 86,
    "competitionId": 2014
  }
];

// Añadir 300 equipos callejeros automáticamente
for (let i = 1; i <= 300; i++) {
  const num = i.toString().padStart(2, '0');
  teams.push({
    name: `Equipo Callejero ${num}`,
    tiktokId: `Bot_${num}`,
    followers: 0,
    displayName: "",
    footballDataId: 0, 
    competitionId: 0 
  });
}
async function seed(existingDb?: any) {
  let db;
  
  if (existingDb) {
    console.log('Usando instancia de DB existente proporcionada');
    db = existingDb;
  } else {
    console.log('Creando nueva conexión a la base de datos');
    const databaseUrl = process.env.DATABASE_URL as string;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not defined');
    }
    const dbInstance = drizzle(databaseUrl);
    const databaseService = new DatabaseService(dbInstance);
    db = databaseService.db;
  }

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

// Si el archivo se ejecuta directamente, ejecutamos el seed
if (require.main === module) {
  console.log('Ejecutando seed.ts como script principal');
  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  console.log('seed.ts importado como módulo');
}

// Exportamos la función para poder importarla desde otros archivos
export { seed };
