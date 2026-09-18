import { httpClient } from '../../../lib/httpClient'
import type { LoginInput, RegistroInput, Usuario } from '../types'

export const authService = {
  registrar: (input: RegistroInput): Promise<Usuario> => httpClient.post<Usuario>('/auth/registrar', input),

  login: (input: LoginInput): Promise<Usuario> => httpClient.post<Usuario>('/auth/login', input),

  logout: (): Promise<{ loggedOut: boolean }> => httpClient.post<{ loggedOut: boolean }>('/auth/logout'),

  me: (): Promise<Usuario> => httpClient.get<Usuario>('/auth/me'),
}
