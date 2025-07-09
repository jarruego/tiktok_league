import { useState } from 'react';
import { message } from 'antd';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from './usePermissions';
import { leagueApi } from '../api/leagueApi';
import { matchApi } from '../api/matchApi';

export function useConfigPageLogic() {
  const auth = useAuth();
  const permissions = usePermissions();
  const user = auth.user;
  
  // Estados básicos
  const [loading, setLoading] = useState(false);
  const [caching, setCaching] = useState(false);
  const [simulatingMatches, setSimulatingMatches] = useState(false);
  const [showSimulationDashboard, setShowSimulationDashboard] = useState(false);
  
  // Estados para gestión de calendario
  const [generating, setGenerating] = useState(false);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [activeSeason, setActiveSeason] = useState<any>(null);
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
      if (initResult.isNewSystem) {
        message.success('Sistema de ligas inicializado correctamente');
      } else {
        message.info(`Sistema ya inicializado. Asignaciones existentes: ${initResult.existingAssignments || 0}`);
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
      message.info('Función de reset temporalmente deshabilitada');
    } catch (error: any) {
      message.error(`Error: ${error.message}`);
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
    } catch (error: any) {
      message.error(`Error al simular partidos: ${error.message}`);
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

  // Retornar todas las propiedades y funciones
  return {
    user,
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
    handleCacheAllCompetitions,
    handleSimulateNextMatchday,
    handleOpenSimulationDashboard,
    handleCloseSimulationDashboard,
    // Funciones de calendario
    handleShowGenerateModal,
    handleGenerateMatches,
    handleShowDeleteModal,
    handleDeleteAllMatches,
    setGenerateModalVisible,
    setDeleteModalVisible
  };
}
