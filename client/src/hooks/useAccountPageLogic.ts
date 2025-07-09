import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { UserRole, ROLE_PERMISSIONS } from '../types/permissions';
import { leagueApi } from '../api/leagueApi';
import { matchApi } from '../api/matchApi';
import { useState } from 'react';
import { message } from 'antd';

export function useAccountPageLogic() {
  const auth = useAuth();
  const permissions = usePermissions();
  const user = auth.user;
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

  // Simulación: el usuario tiene tiktokId si su username contiene "tiktok"
  const tiktokId = user?.username?.includes('tiktok') ? user.username : null;
  const role = user?.role as UserRole;
  const userPermissions = ROLE_PERMISSIONS[role] || [];

  // Acciones admin
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
      let currentSeason: any = null;
      try {
        currentSeason = await leagueApi.getActiveSeason();
        message.info(`Usando temporada existente: ${currentSeason.name}`);
      } catch (error) {
        const currentYear = new Date().getFullYear();
        currentSeason = await leagueApi.createSeason({
          name: `Temporada ${currentYear}-${String(currentYear + 1).slice(2)}`,
          year: currentYear,
          isActive: true
        });
        message.success('Temporada creada correctamente');
      }
      const assignmentStatus = await leagueApi.getAssignmentStatus(currentSeason.id);
      if (assignmentStatus.hasAssignments) {
        message.info('Ya hay equipos asignados en esta temporada.');
      } else {
        const assignResult = await leagueApi.assignTeamsByTikTokFollowers(currentSeason.id);
        if (assignResult.assignedTeams > 0) {
          message.success(`${assignResult.assignedTeams} equipos asignados a divisiones según seguidores de TikTok`);
        } else {
          message.info('Todos los equipos ya estaban asignados');
        }
      }
    } catch (e) {
      message.error('Error al inicializar el sistema');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSystem = async () => {
    console.log('=== INICIO handleResetSystem ===');
    
    try {
      console.log('Obteniendo temporadas...');
      const seasons = await leagueApi.getAllSeasons();
      console.log('Temporadas obtenidas:', seasons);
      
      if (!seasons || seasons.length === 0) {
        console.log('No hay temporadas');
        // Si no hay temporadas, hacer reset completo
        if (!window.confirm('No hay temporadas. ¿Seguro que quieres resetear el sistema completo? Esta acción es irreversible.')) return;
        setLoading(true);
        const result = await leagueApi.resetLeagueSystem();
        message.success(result.message);
        message.warning(result.warning);
        setLoading(false);
        return;
      }

      console.log('Preparando prompt...');
      const seasonOptions = seasons.map(s => `${s.id}: ${s.name} (${s.year})`).join('\n');
      console.log('Opciones preparadas:', seasonOptions);
      
      const choice = window.prompt(
        `Selecciona qué resetear:\n\n` +
        `Temporadas disponibles:\n${seasonOptions}\n\n` +
        `Escribe:\n` +
        `- El ID de una temporada para resetear solo esa temporada\n` +
        `- "TODO" para resetear el sistema completo\n` +
        `- "CANCELAR" para cancelar`
      );

      console.log('Elección del usuario:', choice);

      if (!choice || choice.toUpperCase() === 'CANCELAR') {
        console.log('Usuario canceló');
        return;
      }

      setLoading(true);

      if (choice.toUpperCase() === 'TODO') {
        console.log('Reset completo seleccionado');
        if (!window.confirm('¿Seguro que quieres resetear el sistema COMPLETO? Esto eliminará TODAS las temporadas y configuraciones.')) {
          setLoading(false);
          return;
        }
        const result = await leagueApi.resetLeagueSystem();
        message.success(result.message);
        message.warning(result.warning);
      } else {
        console.log('Reset de temporada específica seleccionado');
        // Intentar parsear como ID de temporada
        const seasonId = parseInt(choice.trim());
        if (isNaN(seasonId)) {
          message.error('ID de temporada inválido');
          setLoading(false);
          return;
        }

        const season = seasons.find(s => s.id === seasonId);
        if (!season) {
          message.error('Temporada no encontrada');
          setLoading(false);
          return;
        }

        if (!window.confirm(`¿Seguro que quieres resetear las asignaciones de "${season.name} (${season.year})"?`)) {
          setLoading(false);
          return;
        }

        const result = await leagueApi.resetSeasonAssignments(seasonId);
        message.success(`${result.message} - ${result.deletedAssignments} asignaciones eliminadas`);
      }
    } catch (e) {
      console.error('ERROR en handleResetSystem:', e);
      const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
      message.error(`Error al resetear el sistema: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
    
    console.log('=== FIN handleResetSystem ===');
  };

  const handleCacheAllCompetitions = async () => {
    setCaching(true);
    try {
      const token = auth.token;
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/football-data/cache/all-competitions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Error');
      message.success('Caché de competiciones poblada correctamente');
    } catch (e) {
      message.error('Error al poblar la caché de competiciones');
    } finally {
      setCaching(false);
    }
  };

  // Simular siguiente jornada
  const handleSimulateNextMatchday = async () => {
    if (!window.confirm('¿Estás seguro de que quieres simular los partidos de la siguiente jornada? Esta acción no se puede deshacer.')) {
      return;
    }

    setSimulatingMatches(true);
    try {
      const result = await matchApi.simulateNextMatchday();
      
      message.success(
        `¡${result.matchesSimulated} partidos simulados exitosamente para el ${result.date}!`
      );

      // Mostrar algunos resultados destacados
      if (result.results.length > 0) {
        const firstFewResults = result.results.slice(0, 3);
        const resultText = firstFewResults
          .map(r => `${r.homeTeamName} ${r.homeGoals}-${r.awayGoals} ${r.awayTeamName}`)
          .join('\n');
        
        message.info(
          `Algunos resultados:\n${resultText}${result.results.length > 3 ? '\n...' : ''}`
        );
      }

    } catch (error: any) {
      message.error(`Error al simular partidos: ${error.message}`);
    } finally {
      setSimulatingMatches(false);
    }
  };

  // Manejar dashboard de simulación
  const handleOpenSimulationDashboard = () => {
    setShowSimulationDashboard(true);
  };

  const handleCloseSimulationDashboard = () => {
    setShowSimulationDashboard(false);
  };

  // Gestión de calendario de partidos
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

  const handleShowGenerateModal = async () => {
    await loadActiveSeasonAndStats();
    setGenerateModalVisible(true);
  };

  const handleGenerateMatches = async (values: any) => {
    if (!activeSeason) return;
    
    try {
      setGenerating(true);
      
      // Validar y asegurar que daysPerMatchday sea un entero válido
      let daysPerMatchday = 7; // valor por defecto
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
      
      // Mostrar mensaje detallado con información de la generación
      let detailMessage = `${result.totalMatches} partidos generados para ${result.leaguesProcessed} ligas`;
      
      if (result.leagueResults && result.leagueResults.length > 0) {
        if (result.leagueResults.length <= 3) {
          // Si hay pocas ligas, mostrar detalles completos
          const leagueDetails = result.leagueResults.map((lr: any) => 
            `${lr.leagueName}: ${lr.matchesGenerated} partidos (${lr.teamsCount} equipos)`
          ).join(', ');
          detailMessage += `. Detalles: ${leagueDetails}`;
        } else {
          // Si hay muchas ligas, mostrar solo un resumen
          const totalTeams = result.leagueResults.reduce((sum: number, lr: any) => sum + lr.teamsCount, 0);
          detailMessage += `. Total de ${totalTeams} equipos participando`;
        }
      }
      
      message.success(detailMessage, 6); // Mostrar durante 6 segundos
      
      setGenerateModalVisible(false);
      await loadActiveSeasonAndStats(); // Recargar estadísticas
    } catch (error: any) {
      console.error('Error generating matches:', error);
      message.error(error.message || 'Error generando partidos');
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
    
    try {
      const result = await matchApi.deleteAllMatchesBySeason(activeSeason.id);
      message.success(`${result.deletedCount} partidos eliminados`);
      setDeleteModalVisible(false);
      await loadActiveSeasonAndStats(); // Recargar estadísticas
    } catch (error: any) {
      message.error(error.message || 'Error eliminando partidos');
      setDeleteModalVisible(false);
    }
  };

  return {
    user,
    permissions,
    tiktokId,
    role,
    userPermissions,
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
