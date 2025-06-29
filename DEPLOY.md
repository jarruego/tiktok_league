# 🚀 Guía de Despliegue en Render

## 📋 Despliegue Paso a Paso desde Cero

### Paso 0: Preparación Previa (IMPORTANTE)

1. **Asegúrate de que tu código esté en GitHub/GitLab**
   ```bash
   # Si no tienes repositorio remoto aún:
   git init
   git add .
   git commit -m "Initial commit - preparar para deploy"
   
   # Crear repo en GitHub y conectar:
   git remote add origin https://github.com/tu-usuario/foodball.git
   git push -u origin main
   ```

2. **Verifica que tienes todos los archivos necesarios**
   - ✅ `client/.env.production`
   - ✅ `server/.env.production` 
   - ✅ `render.yaml`
   - ✅ Scripts de build en package.json

### Paso 1: Crear Cuenta y Configurar Render

1. **Registrarse en Render**
   - Ve a [render.com](https://render.com)
   - Clic en "Get Started for Free"
   - Regístrate con GitHub (recomendado) o email

2. **Conectar GitHub**
   - Una vez dentro, ve a "Account Settings" → "Connected Accounts"
   - Conecta tu cuenta de GitHub
   - Autoriza el acceso a tus repositorios

### Paso 2: Crear Base de Datos PostgreSQL

1. **Desde el Dashboard de Render:**
   - Clic en "New +" → "PostgreSQL"
   
2. **Configuración de la BD:**
   ```
   Name: foodball-db
   Database: foodball_prod
   User: foodball_user
   Region: Oregon (US West) o el más cercano a ti
   Plan: Free (para empezar)
   ```
   
3. **Importante - Guardar datos:**
   ```
   ⚠️ COPIA Y GUARDA ESTOS DATOS:
   - Database URL (External): postgresql://...
   - Database URL (Internal): postgresql://...
   - Host, Port, Database, Username, Password
   ```

### Paso 3: Desplegar Backend (API)

1. **Crear Web Service para Backend:**
   - Dashboard → "New +" → "Web Service"
   - Seleccionar "Build and deploy from a Git repository"
   - Conectar tu repositorio `foodball`

2. **Configuración del Backend:**
   ```
   Name: foodball-backend
   Region: Oregon (US West) - mismo que la BD
   Branch: main
   Root Directory: server
   Runtime: Node
   Build Command: npm install && npm run build
   Start Command: npm run start:prod
   Plan: Free
   ```

3. **Variables de Entorno del Backend:**
   En la sección "Environment Variables":
   ```
   NODE_ENV = production
   PORT = 10000
   DATABASE_URL = [pegar aquí la External Database URL de tu PostgreSQL]
   JWT_SECRET = tu_clave_super_secreta_minimo_32_caracteres_aqui
   CORS_ORIGIN = https://foodball-frontend.onrender.com
   ```
   
   **⚠️ Importante:** 
   - Cambia `foodball-frontend` por el nombre que vayas a usar para tu frontend
   - Genera un JWT_SECRET seguro (puedes usar: `openssl rand -base64 32`)

4. **Crear el servicio:**
   - Clic en "Create Web Service"
   - Esperar a que termine el build (5-10 minutos)

### Paso 4: Ejecutar Migraciones de Base de Datos

1. **Una vez que el backend esté desplegado:**
   - Ve a tu servicio backend en Render
   - Clic en "Shell" (terminal web)
   
2. **Ejecutar migraciones:**
   ```bash
   cd /opt/render/project/src
   npm run db:migrate
   ```
   
   Si no tienes ese comando, usa:
   ```bash
   npx drizzle-kit push
   ```

### Paso 5: Desplegar Frontend

1. **Crear Static Site para Frontend:**
   - Dashboard → "New +" → "Static Site"
   - Seleccionar el mismo repositorio `foodball`

2. **Configuración del Frontend:**
   ```
   Name: foodball-frontend
   Branch: main
   Root Directory: client
   Build Command: npm install && npm run build
   Publish Directory: dist
   ```

3. **Variables de Entorno del Frontend:**
   ```
   VITE_NODE_ENV = production
   VITE_API_BASE_URL = https://foodball-backend.onrender.com
   ```
   
   **⚠️ Importante:** 
   - Cambia `foodball-backend` por el nombre exacto de tu backend

4. **Configurar Headers (Opcional pero recomendado):**
   En "Headers":
   ```
   /*
     Cache-Control: public, max-age=31536000, immutable
   
   /index.html
     Cache-Control: public, max-age=0, must-revalidate
   ```

5. **Crear el sitio:**
   - Clic en "Create Static Site"
   - Esperar a que termine el build

### Paso 6: Actualizar CORS en Backend

1. **Obtener URL del Frontend:**
   - Una vez desplegado, copia la URL de tu frontend (ej: `https://foodball-frontend.onrender.com`)

2. **Actualizar variable CORS_ORIGIN:**
   - Ve a tu servicio backend
   - "Environment" → Editar `CORS_ORIGIN`
   - Poner la URL exacta de tu frontend
   - "Save Changes"

### Paso 7: Verificar y Probar

1. **Verificar que todo funciona:**
   - Ve a la URL de tu frontend
   - Prueba hacer login
   - Verifica que la API responde

2. **Si hay errores, revisar logs:**
   - Backend: Dashboard → Backend Service → "Logs"
   - Frontend: Dashboard → Frontend Service → "Logs"

## 🚨 Errores Comunes y Soluciones

### Error 1: "Cannot connect to database"
```bash
# Verificar que DATABASE_URL está correcto
# Asegurarse de usar la External URL, no la Internal
# Formato: postgresql://user:pass@host:port/database
```

### Error 2: "CORS error"
```bash
# Verificar CORS_ORIGIN en backend exactamente igual a URL frontend
# No incluir "/" al final
# Ejemplo: https://foodball-frontend.onrender.com
```

### Error 3: "Build failed"
```bash
# Verificar que todas las dependencias estén en "dependencies"
# No en "devDependencies" para producción
# Revisar logs de build en Render
```

### Error 4: "404 en rutas del frontend"
```bash
# Agregar redirect rules en Static Site:
# /* /index.html 200
```

# 🚀 Guía de Despliegue: Vercel + Railway + Neon

## Arquitectura de Producción

- **Frontend (React)**: Vercel
- **Backend (NestJS)**: Railway  
- **Base de Datos**: Neon PostgreSQL

## 📋 Despliegue Paso a Paso desde Cero

### Paso 0: Preparación Previa (IMPORTANTE)

1. **Asegúrate de que tu código esté en GitHub**
   ```bash
   git add .
   git commit -m "Preparar para deploy con Vercel + Railway + Neon"
   git push origin main
   ```

2. **Generar JWT Secret** (si no lo tienes)
   ```bash
   .\scripts\generate-jwt-secret.ps1
   ```

### Paso 1: Crear Base de Datos en Neon

1. **Registrarse en Neon**
   - Ve a [neon.tech](https://neon.tech)
   - Clic en "Sign Up" y regístrate con GitHub

2. **Crear Base de Datos:**
   ```
   Project Name: foodball-db
   Database Name: foodball_prod
   Region: US East (Ohio) o el más cercano
   Plan: Free Tier
   ```

3. **Copiar Connection String:**
   ```
   ⚠️ COPIA Y GUARDA:
   DATABASE_URL: postgresql://[user]:[password]@[host].neon.tech/[db]?sslmode=require
   ```

### Paso 2: Desplegar Backend en Railway

1. **Registrarse en Railway**
   - Ve a [railway.app](https://railway.app)
   - Conecta con GitHub

2. **Crear Nuevo Proyecto:**
   - "New Project" → "Deploy from GitHub repo"
   - Seleccionar tu repositorio `foodball`
   - Root Directory: `server`

3. **Configuración Automática:**
   Railway detectará NestJS automáticamente

4. **Variables de Entorno:**
   ```
   NODE_ENV = production
   PORT = 3000
   DATABASE_URL = [tu-neon-connection-string]
   JWT_SECRET = c7tho2j3ClDfuDA7zIzbKUy0zwpv0BplRbSZFISJfmE=
   CORS_ORIGIN = https://foodball-frontend.vercel.app
   ```

5. **Deploy:**
   - Railway ejecutará automáticamente:
     - `npm install`
     - `npm run build`
     - `npm run start:prod`

### Paso 3: Ejecutar Migraciones de Base de Datos

1. **Acceder al Railway Dashboard:**
   - Ve a tu proyecto backend
   - Clic en "Deploy Logs" para verificar que arrancó

2. **Conectar a la BD desde local** (temporal):
   ```bash
   # Usar la connection string de Neon
   cd server
   DATABASE_URL="tu-neon-url" npm run db:migrate
   ```

   O usar Railway CLI:
   ```bash
   railway login
   railway link [tu-proyecto-id]
   railway run npm run db:migrate
   ```

### Paso 4: Desplegar Frontend en Vercel

1. **Registrarse en Vercel**
   - Ve a [vercel.com](https://vercel.com)
   - Conecta con GitHub

2. **Importar Proyecto:**
   - "New Project" → Seleccionar `foodball`
   - Framework Preset: "Vite"
   - Root Directory: `client`

3. **Configuración de Build:**
   ```
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

4. **Variables de Entorno:**
   ```
   VITE_NODE_ENV = production
   VITE_API_BASE_URL = https://[tu-backend].up.railway.app
   VITE_APP_TITLE = Foodball - Liga de Fútbol
   VITE_API_TIMEOUT = 10000
   ```

5. **Deploy:**
   - Clic en "Deploy"
   - Vercel construirá y desplegará automáticamente

### Paso 5: Actualizar CORS en Backend

1. **Obtener URL de Vercel:**
   - Copia la URL final (ej: `https://foodball-frontend.vercel.app`)

2. **Actualizar CORS_ORIGIN en Railway:**
   - Ve a tu proyecto backend en Railway
   - Variables → Editar `CORS_ORIGIN`
   - Valor: URL exacta de Vercel
   - Redeploy automático

### Paso 6: Verificar y Probar

1. **URLs Finales:**
   - Frontend: `https://[proyecto].vercel.app`
   - Backend: `https://[proyecto].up.railway.app`
   - Database: Neon (conectada al backend)

2. **Pruebas:**
   - Visitar frontend
   - Probar login/logout
   - Verificar que carga datos

## ⚡ Ventajas de la Nueva Arquitectura

### Vercel (Frontend)
- ✅ Deploy automático desde Git
- ✅ CDN global ultra-rápido
- ✅ SSL automático
- ✅ Rollbacks instantáneos

### Railway (Backend)
- ✅ Deploy automático desde Git
- ✅ Logs en tiempo real
- ✅ Variables de entorno seguras
- ✅ Scaling automático

### Neon (Database)
- ✅ PostgreSQL sin servidor
- ✅ Branching de BD
- ✅ Scaling automático
- ✅ Backups automáticos

## 🚨 Errores Comunes y Soluciones

### Error 1: "Cannot connect to database"
```bash
# Verificar que DATABASE_URL incluye ?sslmode=require
# Formato: postgresql://user:pass@host.neon.tech/db?sslmode=require
```

### Error 2: "CORS error"
```bash
# Verificar CORS_ORIGIN en Railway = URL exacta de Vercel
# No incluir "/" al final
```

### Error 3: "Build failed en Vercel"
```bash
# Verificar que client/package.json tiene "build" script
# Verificar que todas las deps están en "dependencies"
```

### Error 4: "Railway no encuentra archivos"
```bash
# Verificar Root Directory = "server" en Railway
# Verificar que server/package.json existe
```

### Opción B: Despliegue Manual

#### 1. Crear Base de Datos PostgreSQL
```
- En Render Dashboard → New → PostgreSQL
- Nombre: foodball-db
- Copiar la CONNECTION STRING
```

#### 2. Desplegar Backend
```
- New → Web Service
- Conectar repositorio
- Root Directory: server
- Build Command: npm install && npm run build
- Start Command: npm run start:prod
- Environment Variables:
  * NODE_ENV=production
  * PORT=10000
  * DATABASE_URL=[url-de-tu-db]
  * JWT_SECRET=[tu-clave-secreta]
```

#### 3. Desplegar Frontend
```
- New → Static Site
- Conectar repositorio  
- Root Directory: client
- Build Command: npm install && npm run build
- Publish Directory: dist
- Environment Variables:
  * VITE_API_BASE_URL=[url-de-tu-backend]
  * VITE_NODE_ENV=production
```

## ⚡ Optimizaciones Incluidas

### Frontend
- ✅ Code splitting por chunks (vendor, ui, utils)
- ✅ Minificación con Terser
- ✅ Sourcemaps deshabilitados en producción
- ✅ Headers de caché optimizados

### Backend
- ✅ Build optimizado con NestJS
- ✅ Variables de entorno para producción
- ✅ CORS configurado correctamente
- ✅ Puerto configurable (Render usa PORT dinámico)

## 🐛 Solución de Problemas Comunes

### Error de CORS
- Verificar CORS_ORIGIN en backend
- Verificar VITE_API_BASE_URL en frontend

### Error de Base de Datos
- Verificar DATABASE_URL
- Ejecutar migraciones: `npm run db:migrate`

### Error de Build
- Verificar que todas las dependencias estén en `dependencies` no `devDependencies`
- Revisar logs de build en Render Dashboard

## 📝 Checklist Pre-Despliegue

- [ ] Variables de entorno configuradas
- [ ] Código subido a Git
- [ ] `render.yaml` configurado (o servicios manuales)
- [ ] URLs actualizadas entre servicios
- [ ] JWT_SECRET seguro generado
- [ ] Base de datos PostgreSQL creada

## 🔄 Flujo de CI/CD

Render automáticamente:
1. Detecta cambios en tu repo
2. Ejecuta build commands
3. Despliega automáticamente
4. Reinicia servicios si es necesario

## 💡 Consejos de Producción

1. **Monitoreo**: Usar logs de Render para debugging
2. **Performance**: Activar caché de CDN si es necesario
3. **Seguridad**: Rotar JWT_SECRET periódicamente
4. **Backup**: Hacer backup de PostgreSQL regularmente
5. **SSL**: Render incluye HTTPS automáticamente

## 🆘 Recursos Útiles

- [Documentación Render](https://render.com/docs)
- [Logs en tiempo real](https://render.com/docs/logs)
- [Variables de entorno](https://render.com/docs/environment-variables)
