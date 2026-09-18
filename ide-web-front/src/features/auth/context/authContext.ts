import { createContext, use } from 'react'
import type { LoginInput, RegistroInput, Usuario } from '../types'

export const AUTH_QUERY_KEY = ['auth', 'me'] as const

export interface AuthContextValue {
  usuario: Usuario | null
  isLoading: boolean
  login: (input: LoginInput) => Promise<Usuario>
  registrar: (input: RegistroInput) => Promise<Usuario>
  logout: () => Promise<void>
  isLoginPending: boolean
  isRegistroPending: boolean
  loginError: Error | null
  registroError: Error | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
