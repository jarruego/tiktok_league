import { recalculateAllStandings } from '../api/recalculateApi';
import { organizeAllPlayoffs } from '../api/seasonTransitionApi';
import { useState } from 'react';
import { message } from 'antd';
import { usePermissions } from './usePermissions';
import { leagueApi } from '../api/leagueApi';
import { matchApi } from '../api/matchApi';

export function useConfigPageLogic() {
  // Estados para gestión de calendario (deben ir antes de refreshActiveSeason)
  const [activeSeason, setActiveSeason] = useState<any>(null);
  // Refrescar temporada activa tras crear una nueva
  const refreshActiveSeason = async () => {
    try {
      const season = await leagueApi.getActiveSeason();
      setActiveSeason(season);
    } catch {
      setActiveSeason(null);
    }
  };
  // Eliminado: auth ya no se usa
  const permissions = usePermissions();
  // Eliminado: user ya no se usa
  
  // Estados básicos
  const [loading, setLoading] = useState(false);
  const [caching, setCaching] = useState(false);
  const [simulatingMatches, setSimulatingMatches] = useState(false);
  const [showSimulationDashboard, setShowSimulationDashboard] = useState(false);
  
  // Estados para gestión de calendario
  const [generating, setGenerating] = useState(false);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [matchStats, setMatchStats] = useState({
    totalMatches: 0,
    scheduledMatches: 0,
    finishedMatches: 0
  });
  
  // Estado para mensaje de error visible en interfaz
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Función para inicializar el sistema
  const handleInitializeSystem = async () => {
    setLoading(true);
    try {
      const systemStatus = await leagueApi.getSystemStatus();
      if (systemStatus.isInitialized && systemStatus.hasAssignments) {
        message.info('El sistema ya está inicializado y tiene asignaciones. Se verificará la estructura.');
      }
      
      const initResult = await leagueApi.initializeLeagueSystem();
      
      // Mensaje principal sobre inicialización
      if (initResult.isNewSystem) {
        message.success('Sistema de ligas inicializado correctamente');
      } else {
        message.info(`Sistema ya inicializado. Asignaciones existentes: ${initResult.existingAssignments || 0}`);
      }
      
      // Mensaje sobre seed si corresponde
      if (initResult.seedResult) {
        message.success(`Seed: ${initResult.seedResult}`);
      }
      
      // Mensaje sobre asignación de equipos si corresponde
      if (initResult.assignmentResult) {
        const assignmentResult = initResult.assignmentResult;
        
        if (assignmentResult.assignedTeams > 0) {
          message.success(`Asignación de equipos: ${assignmentResult.assignedTeams} equipos nuevos asignados a ligas`);
        } else if (assignmentResult.wasAlreadyAssigned) {
          message.info(`Asignación de equipos: Todos los equipos (${assignmentResult.totalTeams}) ya estaban asignados a ligas`);
        } else {
          message.warning('No se asignaron equipos a ligas');
        }
      }
    } catch (error: any) {
      message.error(`Error al inicializar el sistema: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Función para resetear el sistema
  const handleResetSystem = async () => {
    setLoading(true);
    try {
      // Mostrar confirmación adicional por seguridad
      if (window.confirm('ADVERTENCIA: Esta acción eliminará las clasificaciones, partidos y asignaciones de equipos de la temporada activa. No se eliminarán los equipos ni las configuraciones de ligas y divisiones. ¿Estás seguro de que deseas continuar? Esta acción no se puede deshacer.')) {
        const result = await leagueApi.resetLeagueSystem();
        message.success(result.message || 'Sistema reseteado correctamente');
        
        if (result.warning) {
          message.warning(result.warning);
        }
      } else {
        message.info('Operación cancelada');
      }
    } catch (error: any) {
      message.error(`Error al resetear el sistema: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Función para ejecutar el seed de inicialización de la BD
  const handleRunDatabaseSeed = async () => {
    setLoading(true);
    try {
      const result = await leagueApi.runDatabaseSeed();
      
      // Personalizar mensaje según la respuesta
      if (result.seedResult) {
        message.success('Seed ejecutado correctamente: Base de datos inicializada con usuarios y equipos de ejemplo');
      } else if (result.message) {
        message.success('Operación completada: ' + result.message);
      } else if (result.isNewSystem) {
        message.success('Sistema de ligas inicializado correctamente');
      } else {
        message.info(`Sistema ya inicializado. Asignaciones existentes: ${result.existingAssignments || 0}`);
      }
      
      // Mensaje sobre asignación de equipos si corresponde
      if (result.assignmentResult) {
        const assignmentResult = result.assignmentResult;
        
        if (assignmentResult.assignedTeams > 0) {
          message.success(`Asignación de equipos: ${assignmentResult.assignedTeams} equipos nuevos asignados a ligas`);
        } else if (assignmentResult.wasAlreadyAssigned) {
          message.info(`Asignación de equipos: Todos los equipos (${assignmentResult.totalTeams}) ya estaban asignados a ligas`);
        } else {
          message.warning('No se asignaron equipos a ligas');
        }
      }
    } catch (error: any) {
      message.error(`Error al ejecutar el seed de la BD: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Función para poblar caché de competiciones
  const handleCacheAllCompetitions = async () => {
    setCaching(true);
    try {
      message.info('Función de cache de competiciones no disponible actualmente');
    } catch (error: any) {
      message.error(`Error: ${error.message}`);
    } finally {
      setCaching(false);
    }
  };

  // Función para simular siguiente jornada
  const handleSimulateNextMatchday = async () => {
    setSimulatingMatches(true);
    try {
      const result = await matchApi.simulateNextMatchday();
      
      if (result.matchesSimulated === 0) {
        message.info('No hay partidos para simular en la próxima jornada');
      } else {
        message.success(`${result.matchesSimulated} partidos simulados en la fecha ${result.date}`);
      }
      
      // Breve pausa para asegurar que el backend haya procesado todo
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return result;
    } catch (error: any) {
      message.error(`Error al simular partidos: ${error.message}`);
      return null;
    } finally {
      setSimulatingMatches(false);
    }
  };

  // Funciones para dashboard de simulación
  const handleOpenSimulationDashboard = () => {
    setShowSimulationDashboard(true);
  };

  const handleCloseSimulationDashboard = () => {
    setShowSimulationDashboard(false);
  };

  // Función para cargar temporada activa y estadísticas
  const loadActiveSeasonAndStats = async () => {
    try {
      const season = await leagueApi.getActiveSeason();
      setActiveSeason(season);
      
      const stats = await matchApi.getSeasonStats(season.id);
      setMatchStats({
        totalMatches: stats.totalMatches,
        scheduledMatches: stats.scheduledMatches,
        finishedMatches: stats.finishedMatches
      });
    } catch (error) {
      console.error('Error loading season stats:', error);
    }
  };

  // Funciones para gestión de calendario
  const handleShowGenerateModal = async () => {
    await loadActiveSeasonAndStats();
    
    // Verificar si ya hay partidos generados antes de mostrar el modal
    if (matchStats.totalMatches > 0) {
      // Usar un mensaje más corto y conciso
      setErrorMessage(`Ya existen ${matchStats.totalMatches} partidos en la temporada actual.`);
    } else {
      // Limpiar mensajes anteriores
      setErrorMessage(null);
    }
    
    setSuccessMessage(null);
    setGenerateModalVisible(true);
  };

  const handleGenerateMatches = async (values: any) => {
    if (!activeSeason) return;
    
    // Limpiar mensajes anteriores
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      setGenerating(true);
      
      // Verificar si ya hay partidos generados antes de continuar
      await loadActiveSeasonAndStats();
      if (matchStats.totalMatches > 0) {
        setErrorMessage(`Ya existen ${matchStats.totalMatches} partidos en la temporada actual. Elimínalos primero.`);
        return;
      }
      
      let daysPerMatchday = 7;
      if (values.daysPerMatchday !== undefined && values.daysPerMatchday !== null) {
        const parsed = Number(values.daysPerMatchday);
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 30) {
          daysPerMatchday = parsed;
        } else {
          message.error('Los días entre jornadas debe ser un número entero entre 1 y 30');
          return;
        }
      }
      
      const generateData = {
        seasonId: activeSeason.id,
        startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : undefined,
        daysPerMatchday
      };
      
      const result = await matchApi.generateMatches(generateData);
      setSuccessMessage(`${result.totalMatches} partidos generados exitosamente`);
      
      setGenerateModalVisible(false);
      await loadActiveSeasonAndStats();
    } catch (error: any) {
      // Solo mostrar errores inesperados en la consola
      if (!error.message || !error.message.includes('Ya existen partidos')) {
        console.error('Error generating matches:', error);
      }
      
      // Detectar si el error es por partidos ya existentes
      if (error.message && error.message.includes('Ya existen partidos')) {
        setErrorMessage('Ya existen partidos en esta temporada. Elimínalos antes de generar nuevos.');
      } else {
        setErrorMessage(error.message || 'Error generando partidos');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleShowDeleteModal = async () => {
    await loadActiveSeasonAndStats();
    setDeleteModalVisible(true);
  };

  const handleDeleteAllMatches = async () => {
    if (!activeSeason) return;
    
    // Limpiar mensajes anteriores
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      const result = await matchApi.deleteAllMatchesBySeason(activeSeason.id);
      setSuccessMessage(`${result.deletedCount} partidos eliminados`);
      setDeleteModalVisible(false);
      await loadActiveSeasonAndStats();
    } catch (error: any) {
      setErrorMessage(error.message || 'Error eliminando partidos');
      // No cerramos el modal en caso de error para mostrar el mensaje
    }
  };

  // Función para simular todos los partidos pendientes
  const handleSimulateAllPendingMatches = async () => {
    setSimulatingMatches(true);
    try {
      console.log('🔍 [DEBUG] Iniciando simulación de todos los partidos pendientes...');
      const result = await matchApi.simulateAllPendingMatches();
      
      if (result.length === 0) {
        message.info('No hay partidos pendientes para simular');
      } else {
        message.success(`✅ ${result.length} partidos simulados correctamente`);
      }
      
      // Breve pausa para asegurar que el backend haya procesado todo
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return result;
    } catch (error: any) {
      console.error('❌ [DEBUG] Error al simular todos los partidos:', error);
      message.error(`Error al simular todos los partidos: ${error.message}`);
      return null;
    } finally {
      setSimulatingMatches(false);
    }
  };

  // Recalcular todas las posiciones de la temporada activa
  const [recalculating, setRecalculating] = useState(false);
  const handleRecalculateAllStandings = async () => {
    console.log('[DEBUG] handleRecalculateAllStandings CLICKED');
    let season = activeSeason;
    if (!season) {
      console.warn('[DEBUG] No active season, trying to refresh...');
      await refreshActiveSeason();
      season = activeSeason;
      // Try to get the updated value after refresh
      if (!season) {
        // setActiveSeason is async, so we need to fetch directly
        try {
          season = await leagueApi.getActiveSeason();
          if (!season) {
            message.error('No hay temporada activa.');
            return;
          }
        } catch (err) {
          message.error('Error obteniendo la temporada activa.');
          return;
        }
      }
    }
    setRecalculating(true);
    try {
      console.log('[DEBUG] Recalculando standings para seasonId:', season.id);
      const result = await recalculateAllStandings(season.id);
      console.log('[DEBUG] Resultado recalculateAllStandings:', result);
      message.success(result.message || 'Clasificaciones recalculadas correctamente');

      console.log('[DEBUG] Llamando a organizeAllPlayoffs...');
      const playoffResult = await organizeAllPlayoffs();
      console.log('[DEBUG] Resultado organizeAllPlayoffs:', playoffResult);
      message.success(playoffResult.message || 'Playoffs organizados');

      // Forzar recarga de temporada y standings tras recalcular y organizar playoffs
      await refreshActiveSeason();
      if (season && matchApi && matchApi.getSeasonStats) {
        try {
          const stats = await matchApi.getSeasonStats(season.id);
          setMatchStats({
            totalMatches: stats.totalMatches,
            scheduledMatches: stats.scheduledMatches,
            finishedMatches: stats.finishedMatches
          });
        } catch (err) {
          console.warn('[DEBUG] No se pudieron refrescar las stats tras recalcular:', err);
        }
      }
    } catch (error: any) {
      console.error('[DEBUG] Error en handleRecalculateAllStandings:', error);
      message.error(error.message || 'Error al recalcular clasificaciones y playoffs');
    } finally {
      setRecalculating(false);
    }
  };

  // Retornar todas las propiedades y funciones
  return {
    permissions,
    loading,
    caching,
    simulatingMatches,
    showSimulationDashboard,
    // Estados de calendario
    generating,
    generateModalVisible,
    deleteModalVisible,
    activeSeason,
    matchStats,
    // Mensajes de estado
    errorMessage,
    successMessage,
    setErrorMessage,
    // Funciones existentes
    handleInitializeSystem,
    handleResetSystem,
    handleRunDatabaseSeed,
    handleCacheAllCompetitions,
    handleSimulateNextMatchday,
    handleSimulateAllPendingMatches,
    handleOpenSimulationDashboard,
    handleCloseSimulationDashboard,
    // Funciones de calendario
    handleShowGenerateModal,
    handleGenerateMatches,
    handleShowDeleteModal,
    handleDeleteAllMatches,
    setGenerateModalVisible,
    setDeleteModalVisible,
    refreshActiveSeason,
    // Recalcular standings
    handleRecalculateAllStandings,
    recalculating
  };
}
