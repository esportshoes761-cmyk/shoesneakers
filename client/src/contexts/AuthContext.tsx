import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string) => {
    // Mock login - in real app, call API
    if (!email || !password) {
      throw new Error('Email y contraseña son requeridos');
    }

    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 500));

    if (password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

    if (email.includes('marketing')) {
      setUser({
        id: '1',
        name: 'Admin Marketing',
        email,
        role: 'marketing'
      });
    } else if (email.includes('emulator')) {
      setUser({
        id: '2',
        name: 'Admin Emulador',
        email,
        role: 'emulator'
      });
    } else if (email.includes('admin')) {
      setUser({
        id: '3',
        name: 'Super Admin',
        email,
        role: 'admin'
      });
    } else {
      throw new Error('Credenciales inválidas');
    }
  };

  const logout = () => {
    setUser(null);
  };

  const hasPermission = (role: UserRole) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.role === role;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};