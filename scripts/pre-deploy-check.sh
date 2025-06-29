#!/bin/bash

# Pre-deployment Check Script
echo "🔍 Verificando configuración para despliegue en Render..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅ $1 existe${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 no encontrado${NC}"
        return 1
    fi
}

# Function to check if command exists
check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✅ $1 instalado${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 no encontrado${NC}"
        return 1
    fi
}

echo ""
echo "📋 Verificando archivos requeridos..."

# Check required files
check_file "client/package.json"
check_file "server/package.json"
check_file "client/.env.production"
check_file "server/.env.production"
check_file "render.yaml"
check_file "client/vite.config.ts"

echo ""
echo "📋 Verificando comandos disponibles..."

# Check required commands
check_command "node"
check_command "npm"
check_command "git"

echo ""
echo "🔧 Verificando scripts de build..."

# Check if build scripts exist
if grep -q '"build"' client/package.json; then
    echo -e "${GREEN}✅ Script build en client/package.json${NC}"
else
    echo -e "${RED}❌ Script build no encontrado en client/package.json${NC}"
fi

if grep -q '"build"' server/package.json; then
    echo -e "${GREEN}✅ Script build en server/package.json${NC}"
else
    echo -e "${RED}❌ Script build no encontrado en server/package.json${NC}"
fi

echo ""
echo "📊 Información del proyecto..."

# Show Node version
echo -e "${YELLOW}Node.js version:${NC} $(node --version)"
echo -e "${YELLOW}NPM version:${NC} $(npm --version)"

# Check Git status
if git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Proyecto bajo control de versiones Git${NC}"
    echo -e "${YELLOW}Branch actual:${NC} $(git branch --show-current)"
    
    # Check if there are uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}⚠️  Tienes cambios sin commitear${NC}"
    else
        echo -e "${GREEN}✅ No hay cambios pendientes${NC}"
    fi
else
    echo -e "${RED}❌ No es un repositorio Git${NC}"
fi

echo ""
echo "📝 Recordatorios importantes:"
echo -e "${YELLOW}1.${NC} Actualizar las URLs en los archivos .env.production"
echo -e "${YELLOW}2.${NC} Generar un JWT_SECRET seguro (mínimo 32 caracteres)"
echo -e "${YELLOW}3.${NC} Verificar que todas las dependencias estén en 'dependencies' no 'devDependencies'"
echo -e "${YELLOW}4.${NC} Hacer commit y push de todos los cambios antes del deploy"

echo ""
echo "🚀 Para desplegar:"
echo "1. git add ."
echo "2. git commit -m 'Ready for production deployment'"
echo "3. git push origin main"
echo "4. Configurar en render.com"

echo ""
echo -e "${GREEN}✨ Verificación completada!${NC}"
