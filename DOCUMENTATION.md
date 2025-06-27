# Documentación Técnica del Proyecto Foodball

## Índice
1. [Autenticación Reactiva](#autenticación-reactiva)
2. [Sistema de Ligas](#sistema-de-ligas) 
3. [Integración Football-Data](#integración-football-data)
4. [Configuración del Servidor](#configuración-del-servidor)
5. [Estrategia de Importación](#estrategia-de-importación)

---

## Autenticación Reactiva

### Problema Resuelto
El sistema de autenticación no era reactivo - cuando el usuario iniciaba o cerraba sesión, la página no se actualizaba automáticamente.

### Solución Implementada

#### 1. AuthContext y Provider (`/client/src/context/AuthContext.tsx`)
- React Context que gestiona el estado de autenticación globalmente
- `AuthProvider` envuelve toda la aplicación
- Hook `useAuth()` para acceder al contexto desde cualquier componente

#### 2. Sistema de Suscripción (`/client/src/api/authApi.ts`)
- Sistema de listeners en el `AuthService`
- Notifica automáticamente cambios de estado
- Métodos: `subscribe()`, `notifyListeners()`

#### 3. Componentes Actualizados
- `AuthStatus`: Usa `useAuth()` para actualizaciones automáticas
- `LoginModal`: Integrado con el contexto
- `usePermissions`: Se basa en el contexto reactivo
- `DivisionView`: Manejo de errores 401 con logout automático

### Flujo de Funcionamiento
1. **Login**: `LoginModal` → `auth.login()` → `authService` → notificación → re-render global
2. **Logout**: `AuthStatus` → `auth.logout()` → `authService` → notificación → re-render global

---

## Sistema de Ligas

### Problema de Duplicación (RESUELTO)
Se creaban divisiones y asignaciones duplicadas al ejecutar múltiples veces la inicialización.

### Solución Idempotente

#### Backend - Funciones Mejoradas
```typescript
// Verificación de estado
isSystemInitialized(): boolean
hasExistingAssignments(seasonId?): boolean
resetLeagueSystem(): Promise<ResetResult>

// Inicialización idempotente
initializeLeagueSystem(): Promise<{
  message: string;
  isNewSystem: boolean;
  existingAssignments?: number;
}>

// Asignación inteligente
assignTeamsToLeaguesByTikTokFollowers(seasonId: number): Promise<{
  message: string;
  assignedTeams: number;
  skippedTeams: number;
  totalTeams: number;
  wasAlreadyAssigned: boolean;
}>
```

#### Características del Sistema
- ✅ **Idempotente**: Ejecutable múltiples veces sin duplicar
- ✅ **Preserva datos**: No elimina asignaciones existentes  
- ✅ **Constraint única**: `unique(divisionId, groupCode)` en tabla leagues
- ✅ **onConflictDoUpdate**: Previene duplicaciones desde endpoints
- ✅ **Informativo**: Reporta estado actual del sistema

#### Frontend - Interfaz Inteligente
- Verificación automática del estado del sistema
- Botones habilitados/deshabilitados según contexto
- Mensajes informativos sobre operaciones
- Reset solo disponible en desarrollo

---

## Integración Football-Data

### Funcionalidad Implementada

#### 🏆 Equipos
- Información básica: nombre, escudo, estadio, año de fundación
- Datos TikTok: seguidores, likes, etc.
- Datos Football-Data: ID externo, nombre corto, colores, website
- Relación con entrenador

#### 👨‍💼 Entrenadores
- Información completa: nombre, nacionalidad, ID de Football-Data
- Gestión automática de creación/actualización
- Relación con equipos

#### ⚽ Jugadores
- Información completa: posición, fecha nacimiento, nacionalidad, número
- Relación con equipo y manejo de conflictos
- Importación masiva desde Football-Data

### Estructura de Datos
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
      "shirtNumber": 1
    }
  ]
}
```

---

## Configuración del Servidor

### Variables de Entorno Requeridas

#### Database Configuration
- **`DATABASE_URL`**: `postgres://username:password@host:port/database`

#### JWT Configuration  
- **`JWT_SECRET`**: Clave secreta para tokens JWT (cambiar en producción)

### Variables Opcionales
- **`PORT`**: Puerto del servidor (por defecto: 3000)
- **`NODE_ENV`**: Entorno (`development`, `production`, `test`)
- **`FOOTBALL_DATA_API_KEY`**: Clave de API de Football-Data.org

### Configuración Rápida
```bash
# 1. Copiar archivo de ejemplo
cp .env.example .env

# 2. Editar variables
DATABASE_URL=postgres://postgres:postgres@localhost:5432/tiktok_teams
JWT_SECRET=mi-clave-super-secreta-para-jwt
PORT=3000
NODE_ENV=development
FOOTBALL_DATA_API_KEY=tu-clave-de-football-data
```

### Validación Automática
- La aplicación valida variables al iniciar
- Falla si `DATABASE_URL` no está definida
- Advierte si `JWT_SECRET` no está configurado

---

## Estrategia de Importación

### Situación Actual
Datos completos de La Liga (2014) con equipos y jugadores desde Football-Data.org.

### Proceso Paso a Paso

#### Fase 1: Mapeo de Equipos
```bash
# 1. Ver equipos disponibles en La Liga
GET /players/competition/2014/teams

# 2. Ver equipos locales
GET /teams

# 3. Mapear equipos existentes
PATCH /teams/{LOCAL_ID}/map-football-data/{FOOTBALL_DATA_ID}
```

#### Fase 2: Importación Masiva
```bash
# Importar equipo completo (recomendado)
POST /players/import/football-data-by-id
{
  "teamId": 1,           // ID local del equipo
  "footballDataTeamId": 77  // Athletic Club en Football-Data
}
```

#### Equipos de La Liga 2014
- Athletic Club: 77
- Real Madrid: 86  
- Barcelona: 81
- Atletico Madrid: 78

### Endpoints Principales
- **Importación masiva**: `POST /players/import/football-data-by-id`
- **Sincronización**: `POST /players/sync/football-data/{teamId}`
- **Estado de caché**: `GET /players/cache-status`
- **Limpiar caché**: `DELETE /players/cache`

---

## DTOs y Estructuras

### Player DTOs
- **CreatePlayerDto**: `teamId`, `name`, `position` (requeridos)
- **UpdatePlayerDto**: Campos opcionales para actualización
- **ImportPlayerDto**: Para importación desde Football-Data

### Auth DTOs
- **LoginDto**: `username`, `password`
- **CreateUserDto**: `username`, `password`, `role`

### Team DTOs
- **CreateTeamDto**: Información básica del equipo
- **UpdateTeamDto**: Actualización de datos del equipo
- **FootballDataMappingDto**: Mapeo con Football-Data

---

## Usuarios del Sistema

### Roles Disponibles
- **admin**: Acceso completo, puede resetear sistema
- **moderator**: Gestión de contenido y usuarios
- **user**: Acceso de solo lectura

### Usuarios por Defecto
- **admin/admin123**: Administrador del sistema
- **moderador/mod123**: Moderador
- **usuario/user123**: Usuario estándar

### Sistema de Permisos
- Control granular basado en roles
- Protección tanto en backend (JWT) como frontend (UI)
- Componente `ProtectedContent` para mostrar/ocultar funcionalidades
