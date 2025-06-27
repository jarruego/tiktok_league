const API_BASE_URL = 'http://localhost:3000';

export interface LoginResponse {
  access_token: string;
  user: {
    id: number;
    username: string;
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: { id: number; username: string } | null;
}

class AuthService {
  private static instance: AuthService;
  private state: AuthState = {
    isAuthenticated: false,
    token: null,
    user: null
  };

  private constructor() {
    // Cargar token desde localStorage al inicializar
    this.loadTokenFromStorage();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private loadTokenFromStorage(): void {
    try {
      const token = localStorage.getItem('auth_token');
      const user = localStorage.getItem('auth_user');
      
      if (token && user) {
        this.state = {
          isAuthenticated: true,
          token,
          user: JSON.parse(user)
        };
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
      this.clearAuth();
    }
  }

  private saveTokenToStorage(token: string, user: { id: number; username: string }): void {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }

  private clearAuth(): void {
    this.state = {
      isAuthenticated: false,
      token: null,
      user: null
    };
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Login failed: ${error}`);
    }

    const data: LoginResponse = await response.json();
    
    // Guardar en estado y localStorage
    this.state = {
      isAuthenticated: true,
      token: data.access_token,
      user: data.user
    };
    
    this.saveTokenToStorage(data.access_token, data.user);
    
    return data;
  }

  logout(): void {
    this.clearAuth();
  }

  getAuthState(): AuthState {
    return { ...this.state };
  }

  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.state.token) {
      headers['Authorization'] = `Bearer ${this.state.token}`;
    }

    return headers;
  }

  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  getToken(): string | null {
    return this.state.token;
  }

  getUser(): { id: number; username: string } | null {
    return this.state.user;
  }
}

export const authService = AuthService.getInstance();

// API functions
export const authApi = {
  async login(username: string, password: string): Promise<LoginResponse> {
    return authService.login(username, password);
  },

  logout(): void {
    authService.logout();
  },

  getAuthState(): AuthState {
    return authService.getAuthState();
  },

  isAuthenticated(): boolean {
    return authService.isAuthenticated();
  },

  getAuthHeaders(): Record<string, string> {
    return authService.getAuthHeaders();
  }
};
