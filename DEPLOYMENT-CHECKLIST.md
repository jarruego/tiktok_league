# ✅ Checklist de Despliegue en Render

## 📋 Lista de Verificación Completa

### Pre-requisitos
- [ ] Código en GitHub/GitLab
- [ ] Archivos `.env.production` creados
- [ ] `render.yaml` configurado
- [ ] Scripts de build funcionando localmente

### 1. Configuración Inicial
- [ ] Cuenta creada en render.com
- [ ] GitHub conectado a Render
- [ ] Repositorio accesible desde Render

### 2. Base de Datos
- [ ] PostgreSQL creado en Render
- [ ] Nombre: `foodball-db`
- [ ] DATABASE_URL copiada y guardada
- [ ] Credenciales anotadas

### 3. Backend (API)
- [ ] Web Service creado
- [ ] Nombre: `foodball-backend`
- [ ] Root Directory: `server`
- [ ] Build Command: `npm install && npm run build`
- [ ] Start Command: `npm run start:prod`
- [ ] Variables de entorno configuradas:
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=10000`
  - [ ] `DATABASE_URL=[url-postgresql]`
  - [ ] `JWT_SECRET=[clave-segura]`
  - [ ] `CORS_ORIGIN=https://[tu-frontend].onrender.com`
- [ ] Despliegue exitoso (sin errores)
- [ ] URL del backend funcionando

### 4. Migraciones
- [ ] Acceso al Shell del backend
- [ ] Migraciones ejecutadas: `npm run db:migrate`
- [ ] Base de datos inicializada

### 5. Frontend
- [ ] Static Site creado
- [ ] Nombre: `foodball-frontend`
- [ ] Root Directory: `client`
- [ ] Build Command: `npm install && npm run build`
- [ ] Publish Directory: `dist`
- [ ] Variables de entorno configuradas:
  - [ ] `VITE_NODE_ENV=production`
  - [ ] `VITE_API_BASE_URL=https://[tu-backend].onrender.com`
- [ ] Headers de caché configurados (opcional)
- [ ] Despliegue exitoso (sin errores)

### 6. Configuración Final
- [ ] CORS_ORIGIN actualizado con URL real del frontend
- [ ] Redirect rules configurados: `/* /index.html 200`
- [ ] SSL/HTTPS funcionando automáticamente

### 7. Pruebas
- [ ] Frontend carga correctamente
- [ ] API responde desde frontend
- [ ] Login/logout funciona
- [ ] Datos se cargan correctamente
- [ ] No hay errores en consola del navegador

### 8. Monitoreo
- [ ] Logs del backend sin errores críticos
- [ ] Logs del frontend sin errores críticos
- [ ] URLs finales anotadas:
  - Frontend: `https://[nombre].onrender.com`
  - Backend: `https://[nombre].onrender.com`

## 🔧 Comandos Útiles

### Generar JWT Secret
```bash
# En tu terminal local:
openssl rand -base64 32
# o usa: https://generate-secret.vercel.app/32
```

### Verificar Build Local
```bash
# Backend
cd server && npm run build && npm run start:prod

# Frontend  
cd client && npm run build && npm run preview
```

### Logs en Tiempo Real
```
1. Ve a tu servicio en Render Dashboard
2. Clic en "Logs" 
3. Mantén abierto mientras pruebas
```

## 🚨 Si Algo Sale Mal

### Backend no inicia
1. Revisar logs del build
2. Verificar que todas las deps están en `dependencies`
3. Verificar DATABASE_URL
4. Verificar formato del JWT_SECRET

### Frontend no carga
1. Revisar logs del build
2. Verificar VITE_API_BASE_URL
3. Verificar que `dist` se genera correctamente
4. Agregar redirect rules

### Errores CORS
1. URL exacta en CORS_ORIGIN (sin `/` final)
2. Reiniciar backend después de cambiar CORS
3. Verificar que frontend llama a la URL correcta

### Base de datos no conecta
1. Usar External Database URL, no Internal
2. Verificar formato: `postgresql://user:pass@host:port/db`
3. Verificar que la BD está en la misma región

## 📞 Soporte
- [Documentación Render](https://render.com/docs)
- [Discord de Render](https://discord.gg/render)
- [Status de Render](https://status.render.com/)
