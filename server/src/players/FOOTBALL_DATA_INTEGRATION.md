# Integración completa con Football-Data.org

## Funcionalidad implementada

Tu base de datos ahora puede almacenar **información completa** de equipos, entrenadores y jugadores desde Football-Data.org:

### 🏆 **Equipos**
- Información básica: nombre, escudo, estadio, año de fundación
- Datos de TikTok: seguidores, likes, etc.
- Datos de Football-Data.org: ID externo, nombre corto, colores, website
- Relación con entrenador

### 👨‍💼 **Entrenadores** 
- Información completa: nombre, nacionalidad, ID de Football-Data.org
- Gestión automática de creación/actualización
- Relación con equipos

### ⚽ **Jugadores**
- Información completa: posición, fecha nacimiento, nacionalidad, número
- Relación con equipo y manejo de conflictos
- Importación masiva desde Football-Data.org

## Estructura de datos de Football-Data.org

### Respuesta completa de `GET /v4/teams/{id}`:

```json
{
  "id": 86,
  "name": "Real Madrid CF",
  "shortName": "Real Madrid",
  "tla": "RMA",
  "crest": "https://.../rma.png",
  "venue": "Santiago Bernabéu",
  "founded": 1902,
  "clubColors": "White / Purple",
  "website": "http://www.realmadrid.com",
  "coach": {
    "id": 2222,
    "name": "Carlo Ancelotti",
    "nationality": "Italy"
  },
  "squad": [
    {
      "id": 1,
      "name": "Thibaut Courtois",
      "position": "Goalkeeper",
      "dateOfBirth": "1992-05-11",
      "nationality": "Belgium",
      "shirtNumber": 1,
      "role": "PLAYER"
    }
  ]
}
```

## Endpoints disponibles

### 📋 **Equipos**
- **GET** `/teams` - Listar equipos con entrenadores
- **GET** `/teams/:id` - Equipo específico
- **PATCH** `/teams/:id/football-data` - Actualizar con datos de Football-Data.org

### 👨‍💼 **Entrenadores**
- Gestionados automáticamente, no necesitas crear endpoints específicos

### ⚽ **Jugadores**
- **POST** `/players/import/football-data` - **Importación completa** (equipos + jugadores + entrenadores)

## Flujo de importación completa

### 1. Importación automática completa:

```javascript
// Una sola llamada importa TODO: equipo, entrenador y jugadores
const response = await fetch('/players/import/football-data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_JWT_TOKEN'
  },
  body: JSON.stringify({
    teamData: {
      "id": 86,
      "name": "Real Madrid CF",
      "shortName": "Real Madrid",
      "tla": "RMA",
      "crest": "https://.../rma.png",
      "venue": "Santiago Bernabéu",
      "founded": 1902,
      "clubColors": "White / Purple",
      "website": "http://www.realmadrid.com",
      "coach": {
        "id": 2222,
        "name": "Carlo Ancelotti",
        "nationality": "Italy"
      },
      "squad": [...]
    },
    importDto: {
      teamId: 1, // Tu ID interno del equipo
      footballDataTeamId: 86,
      source: 'football-data.org'
    }
  })
});
```

### 2. Respuesta de importación completa:

```json
{
  "message": "Successfully imported 25 players and updated team information from Football-Data.org",
  "imported": 25,
  "players": [...],
  "teamInfo": {
    "name": "Real Madrid CF",
    "venue": "Santiago Bernabéu",
    "founded": 1902,
    "coach": "Carlo Ancelotti",
    "updated": true
  },
  "teamUpdateResult": {
    "team": {...},
    "coach": {...},
    "message": "Team updated with Football-Data.org information"
  },
  "conflicts": null,
  "source": "football-data.org"
}
```

## Mapeo de campos

### 🏆 **Equipos**
| Football-Data.org | Tu BD |
|------------------|-------|
| `id` | `footballDataId` |
| `name` | `name` |
| `shortName` | `shortName` |
| `tla` | `tla` |
| `crest` | `crest` |
| `venue` | `venue` |
| `founded` | `founded` |
| `clubColors` | `clubColors` |
| `website` | `website` |

### 👨‍💼 **Entrenadores**
| Football-Data.org | Tu BD |
|------------------|-------|
| `coach.id` | `footballDataId` |
| `coach.name` | `name` |
| `coach.nationality` | `nationality` |

### ⚽ **Jugadores**
| Football-Data.org | Tu BD |
|------------------|-------|
| `squad[].id` | `externalId` |
| `squad[].name` | `name` |
| `squad[].position` | `position` |
| `squad[].dateOfBirth` | `dateOfBirth` |
| `squad[].nationality` | `nationality` |
| `squad[].shirtNumber` | `shirtNumber` |
| `squad[].role` | `role` |

## Ejemplo de uso completo

```javascript
async function importCompleteTeamData(teamId, footballDataTeamId) {
  try {
    // 1. Obtener datos completos del equipo desde Football-Data.org
    const footballDataResponse = await fetch(
      `https://api.football-data.org/v4/teams/${footballDataTeamId}`,
      {
        headers: {
          'X-Auth-Token': 'YOUR_FOOTBALL_DATA_API_KEY'
        }
      }
    );
    
    const teamData = await footballDataResponse.json();
    
    // 2. Importar TODO de una vez: equipo + entrenador + jugadores
    const importResponse = await fetch('/players/import/football-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN'
      },
      body: JSON.stringify({
        teamData: teamData,
        importDto: {
          teamId: teamId,
          footballDataTeamId: footballDataTeamId,
          source: 'football-data.org'
        }
      })
    });
    
    const result = await importResponse.json();
    
    console.log('✅ Importación completa exitosa:');
    console.log(`- Equipo actualizado: ${result.teamInfo.name}`);
    console.log(`- Entrenador: ${result.teamInfo.coach}`);
    console.log(`- Jugadores importados: ${result.imported}`);
    console.log(`- Estadio: ${result.teamInfo.venue}`);
    
  } catch (error) {
    console.error('❌ Error en importación:', error);
  }
}

// Uso
importCompleteTeamData(1, 86); // Importar Real Madrid completo
```

## Nuevas tablas en la BD

### 📋 **Coaches** (nueva tabla)
- `id` (PK)
- `footballDataId` (único)
- `name`
- `nationality`
- `dateOfBirth`
- `contract`
- `createdAt`, `updatedAt`

### 📋 **Teams** (campos añadidos)
- `footballDataId` (único)
- `shortName`
- `tla`
- `crest`
- `venue`
- `founded`
- `clubColors`
- `website`
- `coachId` (FK a coaches)
- `createdAt`, `updatedAt`

### 📋 **Players** (sin cambios)
- Ya tenía todos los campos necesarios ✅

## Gestión de conflictos

- **Entrenadores**: Se crean/actualizan automáticamente
- **Equipos**: Se actualiza información existente
- **Jugadores**: Se evitan duplicados por nombre
- **Números de camiseta**: Se importan sin número si hay conflicto

## Migración de BD

Recuerda ejecutar la migración para crear las nuevas tablas y campos:

```bash
npm run db:generate
npm run db:migrate
```

¡Tu aplicación ahora puede importar información completa de equipos desde Football-Data.org de forma automática! 🚀
