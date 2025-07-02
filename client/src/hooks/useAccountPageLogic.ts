import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { UserRole, ROLE_PERMISSIONS } from '../types/permissions';
import { leagueApi } from '../api/leagueApi';
import { useState } from 'react';
import { message } from 'antd';

export function useAccountPageLogic() {
  const auth = useAuth();
  const permissions = usePermissions();
  const user = auth.user;
  const [loading, setLoading] = useState(false);
  const [caching, setCaching] = useState(false);

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
    if (!window.confirm('¿Seguro que quieres resetear el sistema? Esta acción es irreversible.')) return;
    setLoading(true);
    try {
      await leagueApi.resetLeagueSystem();
      message.success('Sistema reseteado correctamente');
    } catch (e) {
      message.error('Error al resetear el sistema');
    } finally {
      setLoading(false);
    }
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

  return {
    user,
    permissions,
    tiktokId,
    role,
    userPermissions,
    loading,
    caching,
    handleInitializeSystem,
    handleResetSystem,
    handleCacheAllCompetitions
  };
}
