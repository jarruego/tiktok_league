# Configuración de Variables de Entorno

## Variables Requeridas

### Database Configuration
- **`DATABASE_URL`**: URL de conexión a PostgreSQL
  - Formato: `postgres://username:password@host:port/database`
  - Ejemplo: `postgres://postgres:postgres@localhost:5432/tiktok_teams`

### JWT Configuration
- **`JWT_SECRET`**: Clave secreta para firmar tokens JWT
  - **IMPORTANTE**: Cambia esto en producción
  - Ejemplo: `your-super-secret-jwt-key-change-this-in-production`

## Variables Opcionales

### Server Configuration
- **`PORT`**: Puerto del servidor (por defecto: 3000)
- **`NODE_ENV`**: Entorno de ejecución (`development`, `production`, `test`)

### External APIs
- **`FOOTBALL_DATA_API_KEY`**: Clave de API de Football-Data.org (opcional)

## Configuración

1. **Copia el archivo de ejemplo:**
   ```bash
   cp .env.example .env
   ```

2. **Edita las variables en `.env`:**
   ```bash
   # Database Configuration
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/tiktok_teams
   
   # JWT Configuration
   JWT_SECRET=mi-clave-super-secreta-para-jwt
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # Football Data API
   FOOTBALL_DATA_API_KEY=tu-clave-de-football-data
   ```

3. **Validación automática:**
   - La aplicación valida automáticamente las variables al iniciar
   - Falla si `DATABASE_URL` no está definida
   - Advierte si `JWT_SECRET` no está configurado
   - Previene usar valores por defecto en producción

## Configuración por Entorno

### Development
```env
NODE_ENV=development
DATABASE_URL=postgres://postgres:postgres@localhost:5432/tiktok_teams_dev
JWT_SECRET=dev-secret-key
```

### Production
```env
NODE_ENV=production
DATABASE_URL=postgres://user:password@production-host:5432/tiktok_teams
JWT_SECRET=super-secure-production-jwt-secret
```

### Testing
```env
NODE_ENV=test
DATABASE_URL=postgres://postgres:postgres@localhost:5432/tiktok_teams_test
JWT_SECRET=test-secret-key
```

## Seguridad

- ✅ `.env` está incluido en `.gitignore`
- ✅ Usa `.env.example` para documentar variables necesarias
- ✅ Validación automática de configuración
- ✅ Advertencias para valores inseguros en producción

## Uso en el código

Las variables están disponibles globalmente a través de `ConfigService`:

```typescript
// En cualquier servicio
constructor(private configService: ConfigService) {}

// Obtener variable
const dbUrl = this.configService.get<string>('DATABASE_URL');
const jwtSecret = this.configService.get<string>('JWT_SECRET');
const port = this.configService.get<number>('PORT');
```
