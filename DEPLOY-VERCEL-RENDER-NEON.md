# 🚀 Guía de Despliegue: Vercel + Render + Neon

## Arquitectura Gratuita Actualizada

- **Frontend (React)**: Vercel (100% gratuito, excelente)
- **Backend (NestJS)**: Render (plan gratuito mejorado)
- **Base de Datos**: Neon PostgreSQL (ya configurado)

## 📋 Despliegue Paso a Paso

### ✅ Paso 1: Base de Datos (Ya tienes Neon configurado)
```
DATABASE_URL=postgresql://username:password@host:port/database
```

### 🎯 Paso 2: Backend en Render

1. **Ve a [render.com](https://render.com)**
2. **Conectar GitHub**
3. **New Web Service**
4. **Configuración:**
   ```
   Name: tu-app-backend
   Root Directory: server
   Build Command: npm install && npm run build
   Start Command: npm run start:prod
   Plan: Free
   ```

5. **Variables de Entorno:**
   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=postgresql://username:password@host:port/database
   JWT_SECRET=your-super-secret-jwt-key-here
   CORS_ORIGIN=https://tu-frontend.vercel.app
   FOOTBALL_DATA_API_KEY=your-api-key-here
   ```

### 🚀 Paso 3: Frontend en Vercel

1. **Ve a [vercel.com](https://vercel.com)**
2. **Import Project**
3. **Configuración:**
   ```
   Framework: Vite
   Root Directory: client
   Build Command: npm run build
   Output Directory: dist
   ```

4. **Variables de Entorno:**
   ```
   VITE_NODE_ENV=production
   VITE_API_BASE_URL=https://tu-backend.onrender.com
   VITE_APP_TITLE=Tu Aplicación
   VITE_API_TIMEOUT=10000
   ```

## 🚨 **Solución Error 127**

Si ves `bash: line 1: cd: server: No such file or directory`:

1. **Verificar que los cambios estén subidos:**
   ```bash
   git status
   git add .
   git commit -m "Actualizar estructura para deploy"
   git push origin main
   ```

2. **Redesplegar en Render:**
   - Dashboard → tu servicio → "Manual Deploy"
   - Render usará el commit más reciente

## 💡 Ventajas de esta Arquitectura

- ✅ **100% Gratuito**
- ✅ **Neon ya configurado** (no pierdes el trabajo)
- ✅ **Render** ha mejorado mucho vs versiones anteriores
- ✅ **Vercel** sigue siendo el mejor para frontend
- ✅ **Fácil migración** desde tu configuración actual
