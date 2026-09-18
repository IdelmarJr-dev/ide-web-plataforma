import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HttpError } from '../../../lib/httpClient'
import { authService } from '../services/authService'
import type { Usuario } from '../types'
import { AUTH_QUERY_KEY, AuthContext } from './authContext'
import type { AuthContextValue } from './authContext'

async function fetchUsuarioAtual(): Promise<Usuario | null> {
  try {
    return await authService.me()
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) return null
    throw error
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }): ReactNode => {
  const queryClient = useQueryClient()

  const meQuery = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchUsuarioAtual,
    retry: false,
    staleTime: Infinity,
  })

  const loginMutation = useMutation({
    mutationFn: authService.login,
    onSuccess: (usuario) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, usuario)
    },
  })

  const registroMutation = useMutation({
    mutationFn: authService.registrar,
    onSuccess: (usuario) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, usuario)
    },
  })

  const logoutMutation = useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null)
    },
  })

  const value: AuthContextValue = {
    usuario: meQuery.data ?? null,
    isLoading: meQuery.isLoading,
    login: loginMutation.mutateAsync,
    registrar: registroMutation.mutateAsync,
    logout: async () => {
      await logoutMutation.mutateAsync()
    },
    isLoginPending: loginMutation.isPending,
    isRegistroPending: registroMutation.isPending,
    loginError: loginMutation.error,
    registroError: registroMutation.error,
  }

  return <AuthContext value={value}>{children}</AuthContext>
}

export default AuthProvider
