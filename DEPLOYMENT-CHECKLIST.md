# ✅ Checklist de Despliegue: Vercel + Railway + Neon

## 📋 Lista de Verificación Completa

### Pre-requisitos
- [ ] Código en GitHub
- [ ] Archivos `.env.production` actualizados
- [ ] `vercel.json` y `railway.toml` configurados
- [ ] Scripts de build funcionando localmente
- [ ] JWT Secret generado

### 1. Base de Datos (Neon)
- [ ] Cuenta creada en neon.tech
- [ ] PostgreSQL database creada
- [ ] Nombre: `foodball-db`
- [ ] Connection string copiada y guardada
- [ ] SSL mode configurado: `?sslmode=require`

### 2. Backend (Railway)
- [ ] Cuenta creada en railway.app
- [ ] GitHub conectado a Railway
- [ ] Proyecto creado desde repositorio
- [ ] Root Directory: `server`
- [ ] Variables de entorno configuradas:
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=3000`
  - [ ] `DATABASE_URL=[neon-connection-string]`
  - [ ] `JWT_SECRET=[clave-segura]`
  - [ ] `CORS_ORIGIN=https://[tu-vercel].vercel.app`
- [ ] Deploy automático exitoso
- [ ] URL del backend funcionando: `https://[proyecto].up.railway.app`

### 3. Migraciones de Base de Datos
- [ ] Migraciones ejecutadas desde local o Railway CLI
- [ ] Comando: `npm run db:migrate`
- [ ] Base de datos inicializada con tablas

### 4. Frontend (Vercel)
- [ ] Cuenta creada en vercel.com
- [ ] GitHub conectado a Vercel
- [ ] Proyecto importado desde repositorio
- [ ] Framework: Vite detectado automáticamente
- [ ] Root Directory: `client`
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`
- [ ] Variables de entorno configuradas:
  - [ ] `VITE_NODE_ENV=production`
  - [ ] `VITE_API_BASE_URL=https://[tu-railway].up.railway.app`
  - [ ] `VITE_APP_TITLE=Foodball - Liga de Fútbol`
  - [ ] `VITE_API_TIMEOUT=10000`
- [ ] Deploy automático exitoso
- [ ] URL del frontend funcionando: `https://[proyecto].vercel.app`

### 5. Configuración Final
- [ ] CORS_ORIGIN actualizado en Railway con URL real de Vercel
- [ ] SSL/HTTPS funcionando automáticamente en ambos servicios
- [ ] Domains customizados configurados (opcional)

### 6. Pruebas de Integración
- [ ] Frontend carga correctamente
- [ ] API responde desde frontend (verificar Network tab)
- [ ] Login/logout funciona
- [ ] Datos se cargan correctamente desde la BD
- [ ] No hay errores CORS en consola del navegador
- [ ] No hay errores de certificados SSL

### 7. Monitoreo y Logs
- [ ] Logs de Railway sin errores críticos
- [ ] Logs de Vercel sin errores de build
- [ ] Neon dashboard muestra conexiones activas
- [ ] URLs finales documentadas:
  - Frontend: `https://[nombre].vercel.app`
  - Backend: `https://[nombre].up.railway.app`
  - Database: Neon connection monitoreado

## 🔧 Comandos Útiles

### Generar JWT Secret
```bash
# Windows PowerShell:
.\scripts\generate-jwt-secret.ps1

# Node.js alternativo:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Verificar Build Local
```bash
# Backend
cd server && npm run build && npm run start:prod

# Frontend  
cd client && npm run build && npm run preview
```

### Railway CLI (Opcional)
```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login y conectar
railway login
railway link [project-id]

# Ejecutar comandos en Railway
railway run npm run db:migrate
railway logs
```

### Vercel CLI (Opcional)
```bash
# Instalar Vercel CLI
npm install -g vercel

# Login y deploy
vercel login
vercel --prod
```

## 🚨 Solución de Problemas

### Backend (Railway) no inicia
1. Verificar logs en Railway Dashboard
2. Comprobar que `server/package.json` tiene script `start:prod`
3. Verificar DATABASE_URL con `?sslmode=require`
4. Comprobar que todas las deps están en `dependencies`

### Frontend (Vercel) no carga
1. Verificar logs de build en Vercel Dashboard
2. Comprobar que `client/package.json` tiene script `build`
3. Verificar VITE_API_BASE_URL apunta a Railway
4. Verificar que `dist/` se genera correctamente

### Errores CORS
1. URL exacta en CORS_ORIGIN (sin `/` final)
2. Redeploy backend en Railway después de cambiar CORS
3. Verificar que frontend llama a la URL correcta de Railway
4. Comprobar que ambos usan HTTPS

### Base de datos no conecta
1. Usar External Connection String de Neon
2. Verificar formato: `postgresql://user:pass@host.neon.tech/db?sslmode=require`
3. Comprobar que la BD no está pausada en Neon
4. Verificar límites de conexiones en plan gratuito

### Deploys automáticos no funcionan
1. Verificar webhooks en GitHub están configurados
2. Comprobar que los servicios están conectados al branch correcto
3. Verificar permisos de GitHub en Vercel/Railway

## 💰 Planes Gratuitos - Límites

### Vercel Free
- ✅ 100GB bandwidth/mes
- ✅ Deploy automático
- ✅ SSL custom domains
- ⚠️ Límite: 10 deployments/día

### Railway Free
- ✅ $5 crédito mensual
- ✅ Deploy automático  
- ✅ 512MB RAM
- ⚠️ Límite: Se agota con uso 24/7

### Neon Free
- ✅ 3GB storage
- ✅ 1 database
- ✅ SSL connections
- ⚠️ Límite: Database se pausa tras inactividad

## 📞 Soporte
- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app/)
- [Neon Docs](https://neon.tech/docs)
- [Discord Railway](https://discord.gg/railway)
- [Discord Vercel](https://discord.gg/vercel)
