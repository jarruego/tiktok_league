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

## Usos de `calculateStandingsWithConsequences`

### 1. **StandingsService.recalculateStandingsForLeague()** (línea 113) ⚡ **ACTUALIZADO**
**Archivo**: `src/matches/standings.service.ts`
**Motivo**: Recalcula y persiste las clasificaciones en la base de datos tras cambios en los partidos. Aplica automáticamente las marcas de ascenso/descenso/playoff/torneo para mantener coherencia.

### 2. **SeasonTransitionService.processSeasonEnd()** (línea 229)
**Archivo**: `src/teams/season-transition.service.ts`
**Motivo**: Procesa el final de temporada aplicando automáticamente todas las consecuencias (ascensos, descensos, playoffs, torneos) para cada liga de cada división.

### 3. **SeasonTransitionService.organizeSingleLeaguePlayoff()** (línea 344) ⚡ **OPTIMIZADO**
**Archivo**: `src/teams/season-transition.service.ts`
**Motivo**: Genera playoffs para una liga específica. **AHORA USA `calculateStandings`** (lectura rápida) ya que las marcas deberían estar actualizadas tras los partidos regulares.

### 4. **SeasonTransitionService.generateCrossGroupPlayoffs()** (línea 433) ⚡ **OPTIMIZADO**
**Archivo**: `src/teams/season-transition.service.ts`
**Motivo**: Genera playoffs cruzados entre grupos de una división. **AHORA USA `calculateStandings`** (lectura rápida) para obtener las posiciones ya calculadas.

### 5. **SeasonTransitionService.processPromotion()** (línea 1777)
**Archivo**: `src/teams/season-transition.service.ts`
**Motivo**: Procesa ascensos tras finalizar playoffs. Mantiene `calculateStandingsWithConsequences` porque es un proceso oficial de transición que debe asegurar coherencia final.

---

## Usos de `calculateStandings` (solo cálculo, sin aplicar consecuencias)

### 1. **StandingsService.getLeagueStandings()** (línea 282)
**Archivo**: `src/matches/standings.service.ts`
**Motivo**: Obtiene clasificaciones en tiempo real para mostrar en la interfaz. Combina datos calculados con información adicional de equipos (escudos, estados). Ideal para visualización sin modificar marcas.

### 2. **StandingsService.calculateStandingsWithConsequences()** (línea 697)
**Archivo**: `src/matches/standings.service.ts`
**Motivo**: Método que internamente llama a `calculateStandings` y luego aplica las consecuencias automáticamente.

### 3. **SeasonTransitionService.organizeSingleLeaguePlayoff()** (línea 344) ⚡ **OPTIMIZADO**
**Archivo**: `src/teams/season-transition.service.ts`
**Motivo**: Genera playoffs para una liga específica. Usa lectura rápida ya que las marcas deberían estar actualizadas tras los partidos regulares.

### 4. **SeasonTransitionService.generateCrossGroupPlayoffs()** (línea 433) ⚡ **OPTIMIZADO**
**Archivo**: `src/teams/season-transition.service.ts`
**Motivo**: Genera playoffs cruzados entre grupos. Usa lectura rápida para obtener las posiciones ya calculadas.

### 5. **SeasonTransitionController.testUnifiedLogic()** (línea 201)
**Archivo**: `src/teams/season-transition.controller.ts`
**Motivo**: Endpoint de prueba para verificar que la lógica unificada funciona correctamente. Ideal para testing sin aplicar marcas.

### 6. **MatchSimulationService.simulateSingleMatch()** (línea 253) ⚡ **NUEVO**
**Archivo**: `src/matches/match-simulation.service.ts`
**Motivo**: Ahora recalcula clasificaciones automáticamente tras simular un partido individual para mantener coherencia.

---

## Usos Indirectos de `calculateStandingsWithConsequences` (a través de `recalculateStandingsForSeason/League`)

**IMPORTANTE**: Estos métodos ahora usan indirectamente `calculateStandingsWithConsequences` porque `recalculateStandingsForLeague` fue actualizado para usar la versión con consecuencias.

### 1. **MatchSimulationService.simulateRandomMatches()** (línea 92) ⚡ **AHORA APLICA CONSECUENCIAS**
**Archivo**: `src/matches/match-simulation.service.ts`
**Motivo**: Después de simular partidos aleatorios, recalcula las clasificaciones de todas las ligas afectadas Y aplica automáticamente ascensos/descensos/playoffs/torneos.

### 2. **MatchSimulationService.simulateMatchday()** (línea 164) ⚡ **AHORA APLICA CONSECUENCIAS**
**Archivo**: `src/matches/match-simulation.service.ts`
**Motivo**: Tras simular una jornada completa, actualiza las clasificaciones Y aplica las marcas correspondientes automáticamente.

### 3. **MatchSimulationService.simulateAllMatches()** (línea 395) ⚡ **AHORA APLICA CONSECUENCIAS**
**Archivo**: `src/matches/match-simulation.service.ts`
**Motivo**: Después de simular todos los partidos pendientes, recalcula clasificaciones finales Y marca automáticamente equipos para ascenso/descenso/playoff/torneo.

### 4. **MatchController.recalculateStandingsForSeason()** (línea 202) ⚡ **AHORA APLICA CONSECUENCIAS**
**Archivo**: `src/matches/match.controller.ts`
**Motivo**: Endpoint para recalcular manualmente las clasificaciones de una temporada completa Y aplicar todas las marcas automáticamente.

### 5. **MatchController.recalculateStandingsForLeague()** (línea 215) ⚡ **AHORA APLICA CONSECUENCIAS**
**Archivo**: `src/matches/match.controller.ts`
**Motivo**: Endpoint para recalcular manualmente las clasificaciones de una liga específica Y aplicar las marcas correspondientes.

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

## Estrategia de Uso Optimizada

### 🎯 **Nueva Regla Optimizada**: Recálculo automático tras partidos + Lectura eficiente

**Principio**: Las clasificaciones se recalculan automáticamente después de cada partido/jornada, por lo que la mayoría de operaciones solo necesitan **leer** las clasificaciones existentes.

**✅ Usar `calculateStandingsWithConsequences` (SOLO cuando sea necesario):**
- ❗ **Procesos oficiales de transición de temporada** (`processSeasonEnd`, `processPromotion`)
- ❗ **Recálculo manual forzado** tras cambios en partidos (`recalculateStandingsForLeague`)
- ❗ **Endpoints administrativos** para recálculo manual

**📊 Usar `calculateStandings` (lectura rápida - PREFERIDO para operaciones):**
- ✅ **Generación de playoffs** (las marcas ya están aplicadas tras partidos)
- ✅ **Visualización en tiempo real** en interfaces
- ✅ **Testing y debugging**
- ✅ **Cualquier operación que necesite posiciones actuales** pero no modifique marcas

### 🔄 **Flujo Optimizado:**

1. **Simulación de partido individual** → `recalculateStandingsForLeague` → Marcas actualizadas ✅
2. **Simulación de jornada/múltiples partidos** → `recalculateStandingsForSeason` → Todas las marcas actualizadas ✅
3. **Generación de playoffs** → `calculateStandings` (lectura rápida) → Usa marcas ya aplicadas ✅
4. **Final de temporada** → `calculateStandingsWithConsequences` → Asegura coherencia final ✅

---

## Beneficios de la Centralización

1. **Consistencia**: Todos los cálculos usan la misma lógica de desempate
2. **Mantenibilidad**: Cambios en criterios de desempate se aplican automáticamente en todo el sistema
3. **Automatización**: `calculateStandingsWithConsequences` elimina la necesidad de marcar manualmente ascensos/descensos
4. **Reducción de Duplicación**: Se eliminó `calculateDynamicStandings` que duplicaba lógica
5. **Trazabilidad**: Todos los cálculos pasan por un punto central facilitando debugging
6. **🆕 Coherencia de Estado**: Al recalcular automáticamente tras cada partido, las marcas siempre están actualizadas
7. **🆕 Rendimiento Optimizado**: La mayoría de operaciones solo leen clasificaciones ya calculadas, reduciendo carga computacional

---

## Próximos Pasos

1. ✅ **Completado**: Centralizar lógica en `calculateStandings` y `calculateStandingsWithConsequences`
2. ✅ **Completado**: Actualizar todos los servicios para usar la lógica unificada
3. ✅ **Completado**: Resolver dependencias circulares entre módulos
4. ✅ **Completado**: Optimizar estrategia de uso - Recálculo tras partidos + Lectura eficiente
5. ✅ **Completado**: Eliminar métodos @deprecated ya que no son necesarios
6. ✅ **Completado**: Arreglar simulateSingleMatch para recalcular clasificaciones automáticamente
7. 📋 **Pendiente**: Realizar pruebas funcionales para validar la lógica en escenarios reales
8. 📋 **Pendiente**: Considerar refactoring de estructura de módulos para evitar dependencias circulares
