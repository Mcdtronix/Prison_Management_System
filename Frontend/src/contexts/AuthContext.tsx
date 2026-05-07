
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../lib/api';
import { getRoleDisplayName, normalizeRole } from '../lib/auth';

interface User {
  id: number;
  username: string;
  role: string; // Made flexible to handle all backend roles
  roleName: string;
  station: {
    id: number;
    code: string;
    name: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (serviceNumber: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in on app start
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      if (authApi.isAuthenticated()) {
        // Try to get current user profile
        const response = await authApi.getCurrentUser();
        if (response.data) {
          const normalizedRole = normalizeRole(response.data.role_code);
          const userData: User = {
            id: response.data.id,
            username: response.data.username,
            role: normalizedRole,
            roleName: response.data.role_name || getRoleDisplayName(normalizedRole),
            station: {
              id: response.data.station,
              code: response.data.station_code,
              name: response.data.station_name,
            }
          };
          setUser(userData);
          localStorage.setItem('user_role', normalizedRole);
          localStorage.setItem('user_info', JSON.stringify(userData));
        } else {
          // Token exists but profile fetch failed, clear auth
          console.warn('Token exists but profile invalid, clearing auth');
          await logout();
        }
      } else {
        // No token, user is not authenticated
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Clear any invalid auth state
      await logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (serviceNumber: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);

      const response = await authApi.login(serviceNumber, password);

      if (response.data) {
        // Set user from stored info
        const userInfo = localStorage.getItem('user_info');
        if (userInfo) {
          const userData: User = JSON.parse(userInfo);
          setUser(userData);
        }

        return { success: true };
      } else {
        // Handle specific error cases
        let errorMessage = response.error || 'Login failed';

        // Provide user-friendly error messages
        if (errorMessage.includes('Invalid credentials') || errorMessage.includes('No active account')) {
          errorMessage = 'Invalid service number or password. Please check your credentials and try again.';
        } else if (errorMessage.includes('Service number')) {
          errorMessage = 'Invalid service number format. Please enter a valid service number.';
        } else if (errorMessage.includes('account is disabled') || errorMessage.includes('inactive')) {
          errorMessage = 'Your account is inactive. Please contact your administrator.';
        }

        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Unable to connect to the server. Please check your internet connection and try again.'
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
