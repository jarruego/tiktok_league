#!/bin/bash

# Generate secure JWT secret for production
echo "🔐 Generando JWT Secret seguro para producción..."

# Check if openssl is available
if command -v openssl &> /dev/null; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo ""
    echo "✅ JWT Secret generado:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "JWT_SECRET=$JWT_SECRET"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 Copia este valor y úsalo en tu variable de entorno JWT_SECRET en Render"
    echo ""
else
    echo "❌ OpenSSL no encontrado."
    echo "💡 Alternativas:"
    echo "1. Instalar OpenSSL"
    echo "2. Usar generador online: https://generate-secret.vercel.app/32"
    echo "3. Usar Node.js:"
    echo "   node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
fi

echo ""
echo "🔒 Características del JWT Secret:"
echo "• Longitud: 32 bytes (44 caracteres en base64)"
echo "• Altamente seguro y aleatorio"
echo "• Único para tu aplicación"
echo ""
echo "⚠️  IMPORTANTE:"
echo "• Nunca compartas este secret"
echo "• Úsalo solo en variables de entorno de producción"
echo "• Guárdalo en un lugar seguro como backup"
