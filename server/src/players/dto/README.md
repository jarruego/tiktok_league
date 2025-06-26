# Player DTOs

Este directorio contiene los DTOs (Data Transfer Objects) para la gestión de jugadores.

## DTOs Disponibles

### CreatePlayerDto
- Usado para crear un jugador individual
- Requiere: `teamId`, `name`, `position`
- Opcionales: `dateOfBirth`, `nationality`, `shirtNumber`, `role`

### UpdatePlayerDto
- Usado para actualizar jugadores existentes
- Todos los campos son opcionales (extends PartialType)

### GetPlayersQueryDto
- Usado para filtrar jugadores en consultas GET
- Permite filtrar por: `teamId`, `position`, `nationality`, `role`

### ImportPlayersDto
- Usado para importar jugadores desde APIs externas
- Contiene `teamId` y array de `ExternalPlayerDto`
- Incluye campo `source` para identificar la fuente de datos

### ExternalPlayerDto
- Representa un jugador de una API externa
- Incluye campos adicionales como `externalId`, `marketValue`, `contract`

## Endpoints de la API

### Públicos
- `GET /players` - Obtener todos los jugadores (con filtros)
- `GET /players/:id` - Obtener un jugador específico
- `GET /players/team/:teamId` - Obtener jugadores de un equipo

### Protegidos (requieren autenticación)
- `POST /players` - Crear un jugador
- `POST /players/bulk` - Crear múltiples jugadores
- `POST /players/import` - Importar jugadores desde API externa
- `PATCH /players/:id` - Actualizar un jugador
- `DELETE /players/:id` - Eliminar un jugador

## Validaciones

- Los números de camiseta deben ser únicos por equipo
- Los números de camiseta van del 1 al 99
- El rol debe ser: 'PLAYER', 'CAPTAIN', o 'VICE_CAPTAIN'
- Las fechas deben estar en formato ISO string
