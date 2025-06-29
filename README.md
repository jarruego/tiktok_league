# ⚽ Foodball - Sistema de Ligas de Fútbol

> Sistema completo de gestión de ligas de fútbol con autenticación por roles, integración con Football-Data.org y métricas de TikTok.

## 🚀 Características Principales

- **Sistema de Ligas Inteligente**: Organización automática de equipos por divisiones basada en popularidad de TikTok
- **Autenticación por Roles**: Admin, Moderador y Usuario con permisos granulares
- **Integración Football-Data**: Sincronización completa de equipos, jugadores y entrenadores
- **UI Reactiva**: Interfaz moderna con Ant Design y actualizaciones automáticas
- **Backend Robusto**: API REST con NestJS, PostgreSQL y sistema de caché

## 🏗️ Arquitectura

```
foodball/
├── client/          # Frontend React + TypeScript + Vite
│   ├── src/
│   │   ├── api/             # Servicios de API
│   │   ├── components/      # Componentes React
│   │   ├── context/         # Contextos React (Auth)
│   │   ├── hooks/           # Hooks personalizados
│   │   ├── pages/           # Páginas principales
│   │   └── types/           # Tipos TypeScript
│   └── ...
├── server/          # Backend NestJS + PostgreSQL
│   ├── src/
│   │   ├── auth/            # Autenticación JWT
│   │   ├── database/        # Schema y configuración DB
│   │   ├── players/         # Gestión jugadores/equipos
│   │   ├── teams/           # Gestión equipos
│   │   └── football-data/   # Integración Football-Data
│   └── ...
└── DOCUMENTATION.md # Documentación técnica detallada
```

## 🛠️ Tecnologías

### Frontend
- **React 18** + **TypeScript**
- **Vite** - Build tool ultrarrápido
- **Ant Design** - Biblioteca de componentes UI
- **React Router** - Navegación
- **Axios** - Cliente HTTP

### Backend  
- **NestJS** - Framework Node.js
- **PostgreSQL** - Base de datos
- **Drizzle ORM** - Object-Relational Mapping
- **JWT** - Autenticación
- **Football-Data.org API** - Datos de fútbol

## ⚡ Inicio Rápido

### Prerrequisitos
- Node.js 18+
- PostgreSQL 14+
- npm o yarn

### 1. Configuración del Backend

```bash
# Navegar al directorio del servidor
cd server

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# Ejecutar migraciones de base de datos
npm run db:push

# Iniciar el servidor
npm run start:dev
```

### 2. Configuración del Frontend

```bash
# Navegar al directorio del cliente
cd client

# Instalar dependencias
npm install

# Iniciar el cliente
npm run dev
```

### 3. Acceso a la Aplicación

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

## 👥 Usuarios por Defecto

| Usuario | Contraseña | Rol | Permisos |
|---------|------------|-----|----------|
| `admin` | `admin123` | Administrador | Acceso completo, reset del sistema |
| `moderador` | `mod123` | Moderador | Gestión de contenido y usuarios |
| `usuario` | `user123` | Usuario | Solo lectura |

## 📋 Funcionalidades

### 🏆 Sistema de Ligas
- **Divisiones automáticas**: Organización por seguidores de TikTok
- **Múltiples ligas**: Soporte para grupos dentro de divisiones
- **Ascensos/Descensos**: Sistema de promoción/relegación
- **Plazas europeas**: Configuración de competiciones internacionales

### 🔐 Autenticación
- **Login/Logout reactivo**: Actualización instantánea de la UI
- **Permisos granulares**: Control por roles en backend y frontend
- **Sesión persistente**: LocalStorage para mantener sesión

### ⚽ Gestión de Equipos
- **Importación masiva**: Desde Football-Data.org
- **Información completa**: Equipos, jugadores, entrenadores
- **Métricas TikTok**: Seguidores, engagement
- **Mapeo inteligente**: Vinculación con datos externos

### 📊 Interfaz de Usuario
- **Tablas interactivas**: Ordenación, filtros, paginación
- **Vista por divisiones**: Navegación intuitiva entre ligas
- **Estados visuales**: Colores para ascensos, descensos, Europa
- **Responsive**: Adaptable a móvil y escritorio

## 🔧 Configuración Avanzada

### Variables de Entorno (Backend)
```env
# Base de datos
DATABASE_URL=postgres://usuario:contraseña@localhost:5432/foodball

# JWT
JWT_SECRET=tu-clave-secreta-jwt

# APIs externas (opcional)
FOOTBALL_DATA_API_KEY=tu-clave-football-data

# Servidor
PORT=3000
NODE_ENV=development
```

### Scripts Disponibles

#### Backend
```bash
npm run start:dev    # Desarrollo con watch
npm run build        # Compilar para producción
npm run start:prod   # Ejecutar en producción
npm run db:push      # Aplicar cambios a la BD
npm run db:studio    # Interfaz visual de la BD
```

#### Frontend
```bash
npm run dev          # Servidor de desarrollo
npm run build        # Compilar para producción
npm run preview      # Previsualizar build
npm run lint         # Ejecutar linter
```

## 📖 Documentación

Para información técnica detallada, consulta:
- **[DOCUMENTATION.md](./DOCUMENTATION.md)** - Documentación técnica completa
- **[Endpoints de API](./server/README.md)** - Referencia de la API REST

## 🤝 Contribución

1. Fork del proyecto
2. Crear rama para feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit de cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

## 🐛 Reporte de Bugs

Si encuentras algún problema:
1. Verifica que no esté ya reportado en [Issues](../../issues)
2. Crea un nuevo issue con descripción detallada
3. Incluye pasos para reproducir el problema

## ✨ Características Destacadas

- ✅ **Autenticación reactiva** - Sin recarga de página
- ✅ **Sistema idempotente** - Sin duplicaciones de datos  
- ✅ **Integración externa** - Football-Data.org completa
- ✅ **UI moderna** - Ant Design + TypeScript
- ✅ **Backend robusto** - NestJS + PostgreSQL
- ✅ **Permisos granulares** - Control de acceso por roles

## 🚀 Despliegue en Producción

### Guías Completas
- **[DEPLOY.md](./DEPLOY.md)** - Guía paso a paso para Render
- **[DEPLOYMENT-CHECKLIST.md](./DEPLOYMENT-CHECKLIST.md)** - Lista de verificación completa

### Scripts Útiles
```bash
# Generar JWT Secret seguro
./scripts/generate-jwt-secret.sh
# o en Windows:
./scripts/generate-jwt-secret.ps1

# Verificar configuración pre-deploy
./scripts/pre-deploy-check.sh
```

### Comandos de Build
```bash
# Build completo (ambos proyectos)
npm run build

# Solo backend
npm run build:server

# Solo frontend  
npm run build:client

# Limpiar builds
npm run clean
```
