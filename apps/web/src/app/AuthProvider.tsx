import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { User } from '../lib/types';

type AuthValue = {
  user?: User;
  loading: boolean;
  refresh: () => Promise<unknown>;
  clear: () => void;
};
const AuthContext = createContext<AuthValue>({
  loading: true,
  refresh: async () => undefined,
  clear: () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.auth.me,
    retry: false,
    staleTime: 60_000,
  });
  return (
    <AuthContext.Provider
      value={{
        user: query.data,
        loading: query.isLoading,
        refresh: query.refetch,
        clear: () => client.setQueryData(['auth', 'me'], undefined),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
