import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { RegistroForm } from '../components/RegistroForm'

export const RegistroPage = (): ReactNode => {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Criar conta</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Bem-vindo à plataforma! Por favor, identifique-se como professor ou aluno para criar sua conta.
        </p>
      </div>
      <RegistroForm />
      <p className="text-sm text-neutral-600">
        Já tem conta?{' '}
        <Link to="/login" className="font-medium text-primary-600 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}

export default RegistroPage
