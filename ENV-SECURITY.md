# 🔐 Configuración Segura de Variables de Entorno

## ⚠️ IMPORTANTE: Seguridad

- ❌ **NUNCA** subir archivos `.env.production` al repositorio
- ✅ **SOLO** usar `.env.example` como plantilla
- ✅ **Configurar variables reales** en dashboards de servicios

## 🎯 Variables por Servicio

### Render (Backend)
```
NODE_ENV=production
DATABASE_URL=postgresql://foodball-db_owner:npg_gJy4B2kVXfOQ@ep-divine-dew-a90qfo80-pooler.gwc.azure.neon.tech/foodball-db?sslmode=require&channel_binding=require
JWT_SECRET=c7tho2j3ClDfuDA7zIzbKUy0zwpv0BplRbSZFISJfmE=
CORS_ORIGIN=https://foodball-frontend.vercel.app
FOOTBALL_DATA_API_KEY=48f59503f54c4917b158b67adb46ae44
```

### Vercel (Frontend)
```
VITE_NODE_ENV=production
VITE_API_BASE_URL=https://foodball-backend.onrender.com
VITE_APP_TITLE=Foodball - Liga de Fútbol
VITE_API_TIMEOUT=10000
```

## 🚨 En Caso de Exposición Accidental

1. **Regenerar secrets inmediatamente**
2. **Rotar API keys**
3. **Cambiar contraseñas de BD**
4. **Revisar logs de acceso**
