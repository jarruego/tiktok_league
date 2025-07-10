# Documentación de `calculateStandings` y `calculateStandingsWithConsequences`

Este documento lista todos los lugares donde4. **Automatización**: `calculateStandingsWithConsequences` elimina la necesidad de marcar manualmente ascensos/descensos
5. **Reducción de Duplicación**: Se eliminó `calculateDynamicStandings` que duplicaba lógica
6. **Trazabilidad**: Todos los cálculos pasan por un punto central facilitando debugging
7. **🆕 Coherencia de Estado**: Al usar principalmente `calculateStandingsWithConsequences`, las marcas siempre están actualizadas utilizan los métodos centralizados de cálculo de clasificaciones y explica el motivo de cada uso.

## Métodos Centralizados

### `StandingsService.calculateStandings(seasonId, leagueId)`
**Propósito**: Método central que calcula las clasificaciones de una liga específica aplicando los criterios de desempate unificados (puntos → diferencia de goles → goles a favor → enfrentamientos directos → posición alfabética).
**Uso**: Solo para casos donde NO se necesita aplicar marcas de consecuencias (ej: visualización en tiempo real, pruebas).

### `StandingsService.calculateStandingsWithConsequences(seasonId, leagueId, applyMarks?)`
**Propósito**: Calcula clasificaciones y aplica automáticamente las consecuencias (ascensos, descensos, playoffs, torneos) según la configuración de la división.
**Uso**: MÉTODO PREFERIDO para la mayoría de casos. Debe usarse siempre que se requiera que las marcas estén actualizadas.

---

## Usos de `calculateStandings`

### 1. **StandingsService.recalculateStandingsForLeague()** (línea 112) ⚡ **ACTUALIZADO**
**Archivo**: `src/matches/standings.service.ts`
**Motivo**: Recalcula y persiste las clasificaciones en la base de datos tras cambios en los partidos. **AHORA USA `calculateStandingsWithConsequences`** para asegurar que las marcas de ascenso/descenso/playoff/torneo se apliquen automáticamente.

### 2. **StandingsService.getLeagueStandings()** (línea 282)
**Archivo**: `src/matches/standings.service.ts`
**Motivo**: Obtiene clasificaciones en tiempo real para mostrar en la interfaz. Combina datos calculados con información adicional de equipos (escudos, estados). **Mantiene `calculateStandings`** porque solo es para visualización y no modifica marcas.

### 3. **StandingsService.calculateStandingsWithConsequences()** (línea 932)
**Archivo**: `src/matches/standings.service.ts`
**Motivo**: Método que extiende `calculateStandings` para aplicar automáticamente marcas de ascenso/descenso/playoff/torneo.

### 4. **SeasonTransitionService.organizeSingleLeaguePlayoff()** (línea 344) ⚡ **ACTUALIZADO**
**Archivo**: `src/teams/season-transition.service.ts`
**Motivo**: Determina qué equipos se clasifican para playoffs basándose en sus posiciones finales. **AHORA USA `calculateStandingsWithConsequences`** para asegurar que las marcas estén actualizadas antes de generar playoffs.

### 5. **SeasonTransitionService.generateCrossGroupPlayoffs()** (línea 431) ⚡ **ACTUALIZADO**
**Archivo**: `src/teams/season-transition.service.ts`
**Motivo**: Genera playoffs cruzados entre grupos de una división. **AHORA USA `calculateStandingsWithConsequences`** para asegurar que las marcas de playoff estén aplicadas correctamente.

### 6. **SeasonTransitionController.testUnifiedLogic()** (línea 201)
**Archivo**: `src/teams/season-transition.controller.ts`
**Motivo**: Endpoint de prueba para verificar que la lógica unificada funciona correctamente. **Mantiene `calculateStandings`** porque es solo para testing y no necesita aplicar marcas.

---

## Usos de `calculateStandingsWithConsequences`

### 1. **SeasonTransitionService.processSeasonEnd()** (línea 229)
**Archivo**: `src/teams/season-transition.service.ts`
**Motivo**: Procesa el final de temporada aplicando automáticamente todas las consecuencias (ascensos, descensos, playoffs, torneos) para cada liga de cada división.

### 2. **SeasonTransitionService.processPromotion()** (línea 1993)
**Archivo**: `src/teams/season-transition.service.ts`
**Motivo**: Procesa ascensos tras finalizar playoffs. Aplica las marcas correspondientes automáticamente según los resultados de los playoffs.

---

## Usos Indirectos (a través de `recalculateStandingsForSeason/League`)

### 1. **MatchSimulationService.simulateRandomMatches()** (línea 92)
**Archivo**: `src/matches/match-simulation.service.ts`
**Motivo**: Después de simular partidos aleatorios, recalcula las clasificaciones de todas las ligas afectadas para mantener los datos actualizados.

### 2. **MatchSimulationService.simulateMatchday()** (línea 164)
**Archivo**: `src/matches/match-simulation.service.ts`
**Motivo**: Tras simular una jornada completa, actualiza las clasificaciones para reflejar los resultados.

### 3. **MatchSimulationService.simulateAllMatches()** (línea 395)
**Archivo**: `src/matches/match-simulation.service.ts`
**Motivo**: Después de simular todos los partidos pendientes, recalcula clasificaciones finales.

### 4. **MatchController.recalculateStandingsForSeason()** (línea 202)
**Archivo**: `src/matches/match.controller.ts`
**Motivo**: Endpoint para recalcular manualmente las clasificaciones de una temporada completa.

### 5. **MatchController.recalculateStandingsForLeague()** (línea 215)
**Archivo**: `src/matches/match.controller.ts`
**Motivo**: Endpoint para recalcular manualmente las clasificaciones de una liga específica.

---

## ✅ Métodos Deprecated Eliminados

Se han eliminado exitosamente todos los métodos marcados como deprecated:

### ✅ En SeasonTransitionService (ELIMINADOS):
- ~~`markTeamForPromotion()`~~ → Ahora se usa `calculateStandingsWithConsequences()`
- ~~`markTeamForRelegation()`~~ → Ahora se usa `calculateStandingsWithConsequences()`
- ~~`markTeamForPlayoff()`~~ → Ahora se usa `calculateStandingsWithConsequences()`
- ~~`markTeamForTournament()`~~ → Ahora se usa `calculateStandingsWithConsequences()`

### ✅ En StandingsService (ELIMINADOS):
- ~~`applyTiebreakingRules()`~~ → **ELIMINADO** - La lógica está integrada en `calculateStandings()`
- ~~`groupTeamsByPoints()`~~ → **ELIMINADO** - Era método auxiliar del método deprecated
- ~~`resolveTiedTeams()`~~ → **ELIMINADO** - Era método auxiliar del método deprecated
- ~~`groupBy()`~~ → **ELIMINADO** - Era método auxiliar del método deprecated

---

## Frontend (Cliente)

### matchApi.ts
- `recalculateStandings()` (línea 283): Llama al endpoint del backend
- `recalculateStandingsForSeason()` (línea 484): Llama al endpoint del backend

---

## Estrategia de Uso Actualizada

### 🎯 **Regla General**: Usar `calculateStandingsWithConsequences` por defecto

La mayoría de operaciones que calculan clasificaciones necesitan también actualizar las marcas de ascenso/descenso/playoff/torneo. Por esto:

**✅ Usar `calculateStandingsWithConsequences`:**
- Cuando se recalculan clasificaciones tras partidos
- Cuando se generan playoffs
- Cuando se procesa el final de temporada
- Cuando se necesita que las marcas estén actualizadas

**📊 Usar `calculateStandings` (casos específicos):**
- Visualización en tiempo real sin modificar marcas
- Testing y debugging
- Cuando solo se necesitan las posiciones sin aplicar consecuencias

---

## Beneficios de la Centralización

1. **Consistencia**: Todos los cálculos usan la misma lógica de desempate
2. **Mantenibilidad**: Cambios en criterios de desempate se aplican automáticamente en todo el sistema
3. **Automatización**: `calculateStandingsWithConsequences` elimina la necesidad de marcar manualmente ascensos/descensos
4. **Reducción de Duplicación**: Se eliminó `calculateDynamicStandings` que duplicaba lógica
5. **Trazabilidad**: Todos los cálculos pasan por un punto central facilitando debugging

---

## Próximos Pasos

1. ✅ **Completado**: Centralizar lógica en `calculateStandings` y `calculateStandingsWithConsequences`
2. ✅ **Completado**: Actualizar todos los servicios para usar la lógica unificada
3. ✅ **Completado**: Resolver dependencias circulares entre módulos
4. ✅ **Completado**: Optimizar estrategia de uso - Usar `calculateStandingsWithConsequences` por defecto
5. ✅ **Completado**: Eliminar métodos @deprecated ya que no son necesarios
6. 📋 **Pendiente**: Realizar pruebas funcionales para validar la lógica en escenarios reales
7. 📋 **Pendiente**: Considerar refactoring de estructura de módulos para evitar dependencias circulares
