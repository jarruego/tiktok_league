# Generate secure JWT secret for production
Write-Host "Generando JWT Secret seguro para produccion..." -ForegroundColor Green

try {
    # Generate random bytes and convert to base64
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($bytes)
    $jwtSecret = [Convert]::ToBase64String($bytes)
    
    Write-Host ""
    Write-Host "JWT Secret generado:" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Yellow
    Write-Host "JWT_SECRET=$jwtSecret" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Copia este valor y usalo en tu variable de entorno JWT_SECRET en Render" -ForegroundColor White
    
    # Copy to clipboard if possible
    try {
        Set-Clipboard -Value $jwtSecret
        Write-Host "Secret copiado al portapapeles!" -ForegroundColor Green
    } catch {
        Write-Host "No se pudo copiar al portapapeles automaticamente" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Error generando el secret." -ForegroundColor Red
    Write-Host "Alternativas:" -ForegroundColor Yellow
    Write-Host "1. Usar generador online: https://generate-secret.vercel.app/32" -ForegroundColor White
    Write-Host "2. Usar Node.js:" -ForegroundColor White
    Write-Host "   node -e `"console.log(require('crypto').randomBytes(32).toString('base64'))`"" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Caracteristicas del JWT Secret:" -ForegroundColor Blue
Write-Host "- Longitud: 32 bytes (44 caracteres en base64)" -ForegroundColor White
Write-Host "- Altamente seguro y aleatorio" -ForegroundColor White  
Write-Host "- Unico para tu aplicacion" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANTE:" -ForegroundColor Red
Write-Host "- Nunca compartas este secret" -ForegroundColor White
Write-Host "- Usalo solo en variables de entorno de produccion" -ForegroundColor White
Write-Host "- Guardalo en un lugar seguro como backup" -ForegroundColor White

Write-Host ""
Write-Host "Presiona cualquier tecla para continuar..." -ForegroundColor Gray
$null = Read-Host
