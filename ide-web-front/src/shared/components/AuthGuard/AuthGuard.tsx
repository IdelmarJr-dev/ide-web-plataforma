import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '~features/auth/context/authContext'
import type { Papel } from '~features/auth/types'

interface AuthGuardProps {
  children: ReactNode
  roles?: Papel[]
}

export const AuthGuard = ({ children, roles }: AuthGuardProps): ReactNode => {
  const { usuario, isLoading } = useAuth()

  if (isLoading) {
    return <p className="p-6 text-sm text-neutral-600">Carregando…</p>
  }

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(usuario.papel)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default AuthGuard
