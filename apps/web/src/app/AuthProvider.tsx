import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { User } from '../lib/types';

type AuthValue = {
  user?: User;
  loading: boolean;
  refresh: () => Promise<unknown>;
  setUser: (user: User) => void;
  clear: () => Promise<void>;
};
const AuthContext = createContext<AuthValue>({
  loading: true,
  refresh: async () => undefined,
  setUser: () => undefined,
  clear: async () => undefined,
});
const authKey = ['auth', 'me'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const query = useQuery<User | null>({
    queryKey: authKey,
    queryFn: api.auth.me,
    retry: false,
    staleTime: 60_000,
  });
  return (
    <AuthContext.Provider
      value={{
        user: query.data ?? undefined,
        loading: query.isLoading,
        refresh: query.refetch,
        setUser: (user) => {
          client.setQueryData(authKey, user);
        },
        clear: async () => {
          await client.cancelQueries({ queryKey: authKey });
          client.setQueryData(authKey, null);
          client.removeQueries({ predicate: (item) => item.queryKey[0] !== 'auth' });
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
