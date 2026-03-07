import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, AuthResponse, User } from '../services/api';
import { disconnectSocket } from '../hooks/useSocket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, cpf: string) => Promise<void>;
  logout: () => void;
  updateUser: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    // Desconectar socket antes de limpar dados
    disconnectSocket();
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }, [navigate]);

  // Verificar se há token salvo ao carregar
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      
      // Verificar se o token ainda é válido
      authAPI.getMe()
        .then((response) => {
          setUser(response.user);
          localStorage.setItem('user', JSON.stringify(response.user));
        })
        .catch(() => {
          // Token inválido, limpar dados
          logout();
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [logout]);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const response: AuthResponse = await authAPI.login({ email, password });
      
      if (!response.token) {
        throw new Error('Token não recebido do servidor');
      }
      
      setToken(response.token);
      setUser(response.user);
      
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      navigate('/inicio'); // Redirecionar após login
    } catch (error: any) {
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string, cpf: string): Promise<void> => {
    try {
      const response: AuthResponse = await authAPI.register({ name, email, password, cpf });
      
      setToken(response.token!);
      setUser(response.user);
      
      localStorage.setItem('token', response.token!);
      localStorage.setItem('user', JSON.stringify(response.user));
      
      navigate('/inicio'); // Redirecionar após registro
    } catch (error: any) {
      throw error;
    }
  };

  const updateUser = useCallback((userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

