export interface EnvironmentVariables {
  // Database
  DATABASE_URL: string;
  
  // JWT
  JWT_SECRET: string;
  
  // Server
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  
  // External APIs
  FOOTBALL_DATA_API_KEY?: string;
}

export const validateConfig = (): EnvironmentVariables => {
  const config: EnvironmentVariables = {
    DATABASE_URL: process.env.DATABASE_URL || '',
    JWT_SECRET: process.env.JWT_SECRET || '',
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
    FOOTBALL_DATA_API_KEY: process.env.FOOTBALL_DATA_API_KEY,
  };

  // Validaciones
  if (!config.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  if (!config.JWT_SECRET) {
    console.warn('JWT_SECRET not set, using fallback (not recommended for production)');
  }

  if (config.NODE_ENV === 'production' && config.JWT_SECRET === 'your-super-secret-jwt-key-change-this-in-production') {
    throw new Error('Please change JWT_SECRET in production environment');
  }

  return config;
};
