import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FuncionalidadesGrid } from '../components/FuncionalidadesGrid'
import { HeroLanding } from '../components/HeroLanding'
import { LandingFooter } from '../components/LandingFooter'
import { LoginForm } from '../components/LoginForm'

export const LoginPage = (): ReactNode => {
  return (
    <div>
      <HeroLanding />
      <FuncionalidadesGrid />

      <section id="acesso" className="mx-auto max-w-sm px-6 pb-16">
        <div className="rounded-md border border-neutral-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">Entrar</h2>
          <p className="mt-1 text-sm text-neutral-600">Acesso de professor e Aluno.</p>
          <div className="mt-4">
            <LoginForm />
          </div>
          <p className="mt-4 text-sm text-neutral-600">
            Ainda não tem conta?{' '}
            <Link to="/registro" className="font-medium text-primary-600 hover:underline">
              Criar conta
            </Link>
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            É aluno e tem o código da turma?{' '}
            <Link to="/registro?papel=aluno" className="font-medium text-primary-600 hover:underline">
              Criar conta e já entrar na turma
            </Link>
          </p>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}

export default LoginPage
