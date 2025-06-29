# 🔐 Configuración Segura de Variables de Entorno

## ⚠️ IMPORTANTE: Seguridad

- ❌ **NUNCA** subir archivos `.env.production` al repositorio
- ✅ **SOLO** usar `.env.example` como plantilla
- ✅ **Configurar variables reales** en dashboards de servicios

## 🎯 Variables por Servicio

### Render (Backend)
Configurar en Render Dashboard:
```
NODE_ENV=production
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your-super-secret-jwt-key-here
CORS_ORIGIN=https://your-frontend-domain.vercel.app
FOOTBALL_DATA_API_KEY=your-football-data-api-key
```

### Vercel (Frontend)
Configurar en Vercel Dashboard:
```
VITE_NODE_ENV=production
VITE_API_BASE_URL=https://your-backend-domain.onrender.com
VITE_APP_TITLE=Tu Aplicación
VITE_API_TIMEOUT=10000
```

## 🚨 En Caso de Exposición Accidental

1. **Regenerar secrets inmediatamente**
2. **Rotar API keys**
3. **Cambiar contraseñas de BD**
4. **Revisar logs de acceso**

## 📋 Recordatorio

**TODAS las variables sensibles deben configurarse SOLO en:**
- Dashboard de Render (para backend)
- Dashboard de Vercel (para frontend)

**NUNCA en archivos de código o documentación.**

## 🗂️ Estructura de Archivos Segura

```
proyecto/
├── .env.example              ✅ (plantilla pública)
├── .env.production           ❌ (ignorado por git)
├── ENV-SECURITY.md           ❌ (ignorado por git - solo local)
└── docs/
    ├── DEPLOY.md            ✅ (sin secrets reales)
    └── README.md            ✅ (sin secrets reales)
```

**Este archivo debe permanecer local y no subirse al repositorio.**
