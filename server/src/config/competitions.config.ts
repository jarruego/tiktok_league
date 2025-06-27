/**
 * Configuración de competiciones principales para sincronización
 * Esta configuración define las ligas principales que se sincronizan automáticamente
 * 
 * Configuración:
 * 1. Por defecto: DEFAULT_COMPETITIONS (hardcoded)
 * 2. Variables de entorno: ENABLED_COMPETITION_IDS
 * 3. Archivo .env.competitions (opcional)
 */

export interface CompetitionConfig {
  id: number;
  name: string;
  code?: string;
  country?: string;
  enabled?: boolean;
}

/**
 * Competiciones principales por defecto
 * Estas son las ligas que se incluyen en la sincronización masiva automática
 */
export const DEFAULT_COMPETITIONS: CompetitionConfig[] = [
  { 
    id: 2019, 
    name: 'Serie A', 
    code: 'SA', 
    country: 'Italy',
    enabled: true
  },
  { 
    id: 2021, 
    name: 'Premier League', 
    code: 'PL', 
    country: 'England',
    enabled: true
  },
  { 
    id: 2014, 
    name: 'La Liga', 
    code: 'PD', 
    country: 'Spain',
    enabled: true
  },
  { 
    id: 2002, 
    name: 'Bundesliga', 
    code: 'BL1', 
    country: 'Germany',
    enabled: true
  },
  { 
    id: 2015, 
    name: 'Ligue 1', 
    code: 'FL1', 
    country: 'France',
    enabled: true
  },
  { 
    id: 2003, 
    name: 'Eredivisie', 
    code: 'DED', 
    country: 'Netherlands',
    enabled: true
  },
  { 
    id: 2017, 
    name: 'Primeira Liga', 
    code: 'PPL', 
    country: 'Portugal',
    enabled: true
  }
];

/**
 * Obtiene las competiciones habilitadas desde variables de entorno o configuración por defecto
 */
function getCompetitionsFromEnv(): CompetitionConfig[] {
  const enabledIds = process.env.ENABLED_COMPETITION_IDS;
  
  if (enabledIds) {
    const ids = enabledIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    return DEFAULT_COMPETITIONS.filter(comp => ids.includes(comp.id));
  }
  
  return DEFAULT_COMPETITIONS;
}

/**
 * Configuración de sincronización automática
 */
export interface SyncConfig {
  autoSyncEnabled: boolean;
  intervalHours: number;
  maxTeamsPerCompetition: number;
  defaultCompetitionEnabled: boolean;
}

/**
 * Obtiene la configuración de sincronización desde variables de entorno
 */
export function getSyncConfig(): SyncConfig {
  return {
    autoSyncEnabled: process.env.AUTO_SYNC_ALL_ENABLED === 'true',
    intervalHours: parseInt(process.env.AUTO_SYNC_INTERVAL_HOURS || '24'),
    maxTeamsPerCompetition: parseInt(process.env.MAX_TEAMS_PER_COMPETITION || '0'),
    defaultCompetitionEnabled: process.env.DEFAULT_COMPETITION_ENABLED !== 'false'
  };
}

/**
 * Obtiene las competiciones habilitadas para sincronización
 */
export function getEnabledCompetitions(): CompetitionConfig[] {
  return getCompetitionsFromEnv().filter(comp => comp.enabled !== false);
}

/**
 * Obtiene una competición por ID
 */
export function getCompetitionById(id: number): CompetitionConfig | undefined {
  return DEFAULT_COMPETITIONS.find(comp => comp.id === id);
}

/**
 * Obtiene los IDs de todas las competiciones habilitadas
 */
export function getEnabledCompetitionIds(): number[] {
  return getEnabledCompetitions().map(comp => comp.id);
}

/**
 * Información de configuración para debugging
 */
export function getConfigInfo() {
  const syncConfig = getSyncConfig();
  
  return {
    source: process.env.ENABLED_COMPETITION_IDS ? 'environment' : 'default',
    totalAvailable: DEFAULT_COMPETITIONS.length,
    totalEnabled: getEnabledCompetitions().length,
    enabledIds: getEnabledCompetitionIds(),
    envVariable: process.env.ENABLED_COMPETITION_IDS || 'not_set',
    syncConfig: {
      autoSyncEnabled: syncConfig.autoSyncEnabled,
      intervalHours: syncConfig.intervalHours,
      maxTeamsPerCompetition: syncConfig.maxTeamsPerCompetition,
      defaultCompetitionEnabled: syncConfig.defaultCompetitionEnabled
    }
  };
}
