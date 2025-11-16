import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, userStoresApi, User, Store } from '../utils/api';

interface AuthContextType {
  user: User | null;
  stores: Store[];
  currentStore: Store | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectStore: (store: Store | null) => void;
  refreshStores: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = user?.role === 'admin';

  // Load current user on mount
  useEffect(() => {
    loadUser();
  }, []);

  // Load stores when user changes
  useEffect(() => {
    if (user && !isAdmin) {
      loadStores();
    }
  }, [user, isAdmin]);

  async function loadUser() {
    try {
      const { user: currentUser } = await authApi.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      // Not logged in
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadStores() {
    try {
      const { stores: userStores } = await userStoresApi.getMyStores();
      setStores(userStores);

      // Auto-select first store if none selected
      if (userStores.length > 0 && !currentStore) {
        setCurrentStore(userStores[0]);
      }
    } catch (error) {
      console.error('Failed to load stores:', error);
      setStores([]);
    }
  }

  async function login(email: string, password: string) {
    const { user: loggedInUser } = await authApi.login(email, password);
    setUser(loggedInUser);
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
    setStores([]);
    setCurrentStore(null);
  }

  function selectStore(store: Store | null) {
    setCurrentStore(store);
  }

  async function refreshStores() {
    await loadStores();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        stores,
        currentStore,
        isLoading,
        isAdmin,
        login,
        logout,
        selectStore,
        refreshStores,
      }}
    >
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
