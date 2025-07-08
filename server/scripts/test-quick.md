# 🧪 Prueba de Simulación de Partidos

## Test Básico con curl

# Ver estadísticas antes de simular
echo "📊 Estadísticas ANTES de la simulación:"
curl -s http://localhost:3000/api/matches/simulation/stats | jq

# Ver partidos de hoy
echo ""
echo "⚽ Partidos programados para hoy:"
curl -s "http://localhost:3000/api/matches?status=scheduled&fromDate=2025-07-08&toDate=2025-07-08&limit=3" | jq '.matches[] | {id, homeTeam: .homeTeam.name, awayTeam: .awayTeam.name, scheduledDate}'

# Simular partidos de hoy (requiere autenticación - comentado)
# echo ""
# echo "🎮 Simulando partidos de hoy..."
# curl -X POST -H "Content-Type: application/json" -d '{"date":"2025-07-08"}' http://localhost:3000/api/matches/simulate/date

# Ver estadísticas después (descomentado cuando se haga la simulación)
# echo ""
# echo "📊 Estadísticas DESPUÉS de la simulación:"
# curl -s http://localhost:3000/api/matches/simulation/stats | jq
