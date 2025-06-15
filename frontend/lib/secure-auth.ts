/**
 * SECURE FRONTEND AUTHENTICATION
 * Implements secure token handling and API communication
 */

export interface User {
  id: string;
  email: string;
  isAdmin?: boolean;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class SecureAuthManager {
  private token: string | null = null;
  private user: User | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  
  // API base URL
  private readonly API_BASE = 'http://localhost:5001/api';
  
  constructor() {
    // Initialize from secure storage on client side only
    if (typeof window !== 'undefined') {
      this.initializeFromStorage();
    }
  }

  private initializeFromStorage(): void {
    try {
      // Check for token in HTTP-only cookie (preferred method)
      // Note: HTTP-only cookies can't be accessed by JavaScript
      // This would be handled by the browser automatically in requests
      
      // Fallback: Check for token in sessionStorage (less secure but functional)
      const storedToken = sessionStorage.getItem('auth_token');
      const storedUser = sessionStorage.getItem('user_data');
      
      if (storedToken && storedUser) {
        this.token = storedToken;
        this.user = JSON.parse(storedUser);
        this.startTokenRefresh();
      }
    } catch (error) {
      console.error('Error loading auth data:', error);
      this.clearAuthData();
    }
  }

  private saveToStorage(token: string, user: User): void {
    try {
      // Store in sessionStorage (cleared when browser closes)
      sessionStorage.setItem('auth_token', token);
      sessionStorage.setItem('user_data', JSON.stringify(user));
      
      // In production, prefer HTTP-only cookies set by server
    } catch (error) {
      console.error('Error saving auth data:', error);
    }
  }

  private clearAuthData(): void {
    this.token = null;
    this.user = null;
    
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('user_data');
    }
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private startTokenRefresh(): void {
    // Refresh token every 20 minutes (before 24-hour expiry)
    this.refreshTimer = setTimeout(() => {
      this.refreshToken();
    }, 20 * 60 * 1000);
  }

  private async refreshToken(): Promise<void> {
    try {
      const response = await this.secureRequest('/auth/refresh', {
        method: 'POST',
      });

      if (response.success && response.token) {
        this.token = response.token;
        this.startTokenRefresh();
      } else {
        // Token refresh failed, logout user
        this.logout();
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.logout();
    }
  }

  public async login(email: string, password: string): Promise<AuthResponse> {
    try {
      // Input validation
      if (!email || !password) {
        return { success: false, error: 'Email and password are required' };
      }

      if (!this.isValidEmail(email)) {
        return { success: false, error: 'Invalid email format' };
      }

      const response = await fetch(`${this.API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password: password,
        }),
      });

      const data: AuthResponse = await response.json();

      if (data.success && data.token && data.user) {
        this.token = data.token;
        this.user = data.user;
        this.saveToStorage(data.token, data.user);
        this.startTokenRefresh();
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  public async register(email: string, password: string): Promise<AuthResponse> {
    try {
      // Input validation
      if (!email || !password) {
        return { success: false, error: 'Email and password are required' };
      }

      if (!this.isValidEmail(email)) {
        return { success: false, error: 'Invalid email format' };
      }

      if (password.length < 8) {
        return { success: false, error: 'Password must be at least 8 characters' };
      }

      const response = await fetch(`${this.API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password: password,
        }),
      });

      const data: AuthResponse = await response.json();

      if (data.success && data.token && data.user) {
        this.token = data.token;
        this.user = data.user;
        this.saveToStorage(data.token, data.user);
        this.startTokenRefresh();
      }

      return data;
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  public logout(): void {
    // Call logout endpoint to invalidate server-side session
    if (this.token) {
      fetch(`${this.API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
        credentials: 'include',
      }).catch(error => {
        console.error('Logout request failed:', error);
      });
    }

    this.clearAuthData();
  }

  public isAuthenticated(): boolean {
    return this.token !== null && this.user !== null;
  }

  public getUser(): User | null {
    return this.user;
  }

  public getToken(): string | null {
    return this.token;
  }

  public async secureRequest<T = any>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      if (!this.token) {
        throw new Error('No authentication token available');
      }

      const url = endpoint.startsWith('http') ? endpoint : `${this.API_BASE}${endpoint}`;
      
      const headers = new Headers(options.headers);
      headers.set('Content-Type', 'application/json');
      headers.set('Authorization', `Bearer ${this.token}`);

      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      // Handle authentication errors
      if (response.status === 401) {
        this.logout();
        throw new Error('Authentication expired. Please login again.');
      }

      if (response.status === 429) {
        throw new Error('Too many requests. Please wait and try again.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Secure request failed:', error);
      throw error;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Rate limiting helper
  private requestCounts = new Map<string, { count: number; resetTime: number }>();

  public checkRateLimit(endpoint: string, maxRequests: number = 60, windowMs: number = 60000): boolean {
    const now = Date.now();
    const key = endpoint;
    const requestData = this.requestCounts.get(key);

    if (!requestData || now > requestData.resetTime) {
      this.requestCounts.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (requestData.count >= maxRequests) {
      return false;
    }

    requestData.count++;
    return true;
  }
}

// Singleton instance
export const authManager = new SecureAuthManager();

// React hook for authentication state
import { useState, useEffect } from 'react';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const currentUser = authManager.getUser();
      setUser(currentUser);
      setIsLoading(false);
    };

    checkAuth();

    // Listen for storage changes (logout from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token' && !e.newValue) {
        setUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authManager.login(email, password);
      if (result.success && result.user) {
        setUser(result.user);
      }
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authManager.logout();
    setUser(null);
  };

  return {
    user,
    isLoading,
    isAuthenticated: authManager.isAuthenticated(),
    login,
    logout,
    secureRequest: authManager.secureRequest.bind(authManager),
  };
}

// Protected route component
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return fallback || <div>Loading...</div>;
  }

  if (!user) {
    return fallback || null;
  }

  return <>{children}</>;
}