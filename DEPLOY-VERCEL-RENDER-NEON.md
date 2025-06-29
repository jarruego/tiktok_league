# 🚀 Guía de Despliegue: Vercel + Render + Neon

## Arquitectura Gratuita Actualizada

- **Frontend (React)**: Vercel (100% gratuito, excelente)
- **Backend (NestJS)**: Render (plan gratuito mejorado)
- **Base de Datos**: Neon PostgreSQL (ya configurado)

## 📋 Despliegue Paso a Paso

### ✅ Paso 1: Base de Datos (Ya tienes Neon configurado)
```
DATABASE_URL=postgresql://foodball-db_owner:npg_gJy4B2kVXfOQ@ep-divine-dew-a90qfo80-pooler.gwc.azure.neon.tech/foodball-db?sslmode=require&channel_binding=require
```

### 🎯 Paso 2: Backend en Render

1. **Ve a [render.com](https://render.com)**
2. **Conectar GitHub**
3. **New Web Service**
4. **Configuración:**
   ```
   Name: foodball-backend
   Root Directory: server
   Build Command: npm install && npm run build
   Start Command: npm run start:prod
   Plan: Free
   ```

5. **Variables de Entorno:**
   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=postgresql://foodball-db_owner:npg_gJy4B2kVXfOQ@ep-divine-dew-a90qfo80-pooler.gwc.azure.neon.tech/foodball-db?sslmode=require&channel_binding=require
   JWT_SECRET=c7tho2j3ClDfuDA7zIzbKUy0zwpv0BplRbSZFISJfmE=
   CORS_ORIGIN=https://foodball-frontend.vercel.app
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
   VITE_API_BASE_URL=https://foodball-backend.onrender.com
   VITE_APP_TITLE=Foodball - Liga de Fútbol
   VITE_API_TIMEOUT=10000
   ```

## 💡 Ventajas de esta Arquitectura

- ✅ **100% Gratuito**
- ✅ **Neon ya configurado** (no pierdes el trabajo)
- ✅ **Render** ha mejorado mucho vs versiones anteriores
- ✅ **Vercel** sigue siendo el mejor para frontend
- ✅ **Fácil migración** desde tu configuración actual
