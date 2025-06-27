// Definición de roles del sistema
export const UserRole = {
  ADMIN: 'admin',
  MODERATOR: 'moderator', 
  USER: 'user'
} as const;

export type UserRole = typeof UserRole[keyof typeof UserRole];

// Definición de permisos específicos
export const Permission = {
  // Permisos de sistema
  RESET_SYSTEM: 'reset_system',
  VIEW_SYSTEM_INFO: 'view_system_info',
  INITIALIZE_SYSTEM: 'initialize_system',
  
  // Permisos de equipos
  CREATE_TEAM: 'create_team',
  EDIT_TEAM: 'edit_team',
  DELETE_TEAM: 'delete_team',
  VIEW_TEAM_DETAILS: 'view_team_details',
  
  // Permisos de jugadores
  CREATE_PLAYER: 'create_player',
  EDIT_PLAYER: 'edit_player',
  DELETE_PLAYER: 'delete_player',
  SYNC_PLAYERS: 'sync_players',
  
  // Permisos de ligas
  CREATE_SEASON: 'create_season',
  ASSIGN_TEAMS: 'assign_teams',
  VIEW_LEAGUE_MANAGEMENT: 'view_league_management',
  
  // Permisos de configuración
  VIEW_CONFIG: 'view_config',
  EDIT_CONFIG: 'edit_config',
  MANAGE_COMPETITIONS: 'manage_competitions',
  
  // Permisos de usuarios
  MANAGE_USERS: 'manage_users',
  VIEW_USER_LIST: 'view_user_list'
} as const;

export type Permission = typeof Permission[keyof typeof Permission];

// Mapa de permisos por rol
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // Admin tiene todos los permisos
    ...Object.values(Permission)
  ],
  
  [UserRole.MODERATOR]: [
    // Moderador puede gestionar equipos y jugadores, pero no sistema
    Permission.CREATE_TEAM,
    Permission.EDIT_TEAM,
    Permission.VIEW_TEAM_DETAILS,
    Permission.CREATE_PLAYER,
    Permission.EDIT_PLAYER,
    Permission.SYNC_PLAYERS,
    Permission.VIEW_LEAGUE_MANAGEMENT,
    Permission.VIEW_CONFIG,
    Permission.VIEW_USER_LIST
  ],
  
  [UserRole.USER]: [
    // Usuario solo puede ver información
    Permission.VIEW_TEAM_DETAILS,
    Permission.VIEW_LEAGUE_MANAGEMENT
  ]
};

// Función para verificar si un rol tiene un permiso específico
export function hasPermission(userRole: UserRole | string, permission: Permission): boolean {
  if (!userRole || typeof userRole !== 'string') return false;
  
  const role = userRole as UserRole;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

// Función para verificar múltiples permisos (AND)
export function hasAllPermissions(userRole: UserRole | string, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

// Función para verificar al menos uno de varios permisos (OR)
export function hasAnyPermission(userRole: UserRole | string, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

// Función para obtener todos los permisos de un rol
export function getRolePermissions(userRole: UserRole | string): Permission[] {
  if (!userRole || typeof userRole !== 'string') return [];
  
  const role = userRole as UserRole;
  return ROLE_PERMISSIONS[role] || [];
}

// Función para verificar si es admin
export function isAdmin(userRole: UserRole | string): boolean {
  return userRole === UserRole.ADMIN;
}

// Función para verificar si es moderador o superior
export function isModerator(userRole: UserRole | string): boolean {
  return userRole === UserRole.ADMIN || userRole === UserRole.MODERATOR;
}

// Función para verificar si puede realizar operaciones administrativas
export function canAdministrate(userRole: UserRole | string): boolean {
  return hasAnyPermission(userRole, [
    Permission.RESET_SYSTEM,
    Permission.INITIALIZE_SYSTEM,
    Permission.CREATE_SEASON,
    Permission.MANAGE_COMPETITIONS
  ]);
}

// Función para obtener el nivel numérico del rol (para comparaciones)
export function getRoleLevel(userRole: UserRole | string): number {
  switch (userRole) {
    case UserRole.ADMIN: return 3;
    case UserRole.MODERATOR: return 2;
    case UserRole.USER: return 1;
    default: return 0;
  }
}

// Información descriptiva de los roles
export const ROLE_INFO: Record<UserRole, { name: string; description: string; color: string }> = {
  [UserRole.ADMIN]: {
    name: 'Administrador',
    description: 'Acceso completo al sistema, puede resetear, configurar y gestionar todo',
    color: '#ff4d4f'
  },
  [UserRole.MODERATOR]: {
    name: 'Moderador', 
    description: 'Puede gestionar equipos, jugadores y visualizar configuraciones',
    color: '#faad14'
  },
  [UserRole.USER]: {
    name: 'Usuario',
    description: 'Solo puede visualizar información de equipos y ligas',
    color: '#52c41a'
  }
};
