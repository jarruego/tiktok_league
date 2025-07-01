# ⚽ TikTok Football League.

> Sistema de gestión de ligas de fútbol con organización automática de equipos basada en métricas de redes sociales.

## 🚀 Características

- **Sistema de Ligas Inteligente**: Organización automática por divisiones
- **Autenticación por Roles**: Admin, Moderador, Usuario
- **Integración Football-Data**: Equipos, jugadores y entrenadores reales
- **UI Moderna**: React + TypeScript + Ant Design
- **API REST**: NestJS + PostgreSQL

## 🏗️ Arquitectura

```
├── client/          # Frontend (React + Vite)
│   ├── src/
│   │   ├── api/           # Servicios HTTP
│   │   ├── components/    # Componentes React
│   │   ├── context/       # Contextos (Auth)
│   │   ├── pages/         # Páginas principales
│   │   └── types/         # Tipos TypeScript
└── server/          # Backend (NestJS + PostgreSQL)
    ├── src/
    │   ├── auth/          # JWT + Roles
    │   ├── database/      # Schema DB
    │   ├── teams/         # Gestión equipos
    │   └── players/       # Gestión jugadores
```

## 🛠️ Stack Tecnológico

### Frontend
- React 18 + TypeScript + Vite
- Ant Design + React Router
- Axios para HTTP

### Backend
- NestJS + PostgreSQL
- Drizzle ORM + JWT Auth
- Football-Data.org API

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 18+
- PostgreSQL 14+
- npm/yarn

### Instalación

1. **Clonar repositorio**
```bash
git clone https://github.com/tu-usuario/tiktok-football-league.git
cd tiktok-football-league
```

2. **Configurar Backend**
```bash
cd server
npm install
cp .env.example .env
# Configurar variables en .env
npm run db:migrate
npm run start:dev
```

3. **Configurar Frontend**
```bash
cd client
npm install
cp .env.example .env
# Configurar variables en .env
npm run dev
```

### Variables de Entorno

**Backend (.env)**
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
JWT_SECRET=your-jwt-secret-here
FOOTBALL_DATA_API_KEY=your-api-key (opcional)
```

**Frontend (.env)**
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_TITLE=TikTok Football League
```

## 👥 Usuarios por Defecto

- **admin/admin123** - Administrador
- **moderador/mod123** - Moderador  
- **usuario/user123** - Usuario

## 📱 Funcionalidades Principales

### Sistema de Ligas
- Creación automática de divisiones
- Asignación inteligente de equipos
- Rankings y clasificaciones

### Gestión de Equipos
- Información completa de equipos
- Integración con Football-Data.org
- Métricas de redes sociales

### Autenticación
- Login/logout seguro
- Control de acceso por roles
- JWT tokens

## 🧪 Testing

```bash
# Backend
cd server
npm run test
npm run test:e2e

# Frontend  
cd client
npm run test
```

## 📦 Despliegue

El proyecto está configurado para desplegarse en:
- **Frontend**: Vercel/Netlify
- **Backend**: Render/Railway
- **Base de Datos**: Neon/Supabase

Ver archivos de configuración incluidos para cada plataforma.

## 🤝 Contribución

1. Fork del proyecto
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🔗 Enlaces

- [Football-Data.org](https://www.football-data.org/) - API de datos de fútbol
- [Ant Design](https://ant.design/) - Biblioteca de componentes
- [NestJS](https://nestjs.com/) - Framework backend
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

### Arquitectura Recomendada
- **Frontend**: Vercel (React + Vite)
- **Backend**: Render/Railway (NestJS + Node.js)  
- **Base de Datos**: Neon (PostgreSQL)

### Generar JWT Secret
```bash
# Comando directo para generar JWT secret
openssl rand -base64 32

# O en Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Comandos de Build
```bash
# Backend
cd server && npm run build

# Frontend  
cd client && npm run build

# Desarrollo
cd server && npm run start:dev
cd client && npm run dev
```
