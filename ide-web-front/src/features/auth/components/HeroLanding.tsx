import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export const HeroLanding = (): ReactNode => {
  return (
    <header
      className="relative overflow-hidden bg-neutral-900 text-neutral-50"
      style={{
        backgroundImage:
          'linear-gradient(to right, color-mix(in oklch, var(--color-primary-500) 12%, transparent) 1px, transparent 1px),' +
          'linear-gradient(to bottom, color-mix(in oklch, var(--color-primary-500) 12%, transparent) 1px, transparent 1px)',
        backgroundSize: '2.5rem 2.5rem',
      }}
    >
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-mono text-xl font-bold tracking-tight text-neutral-50">IDE Web</span>
        <a href="#acesso" className="text-sm font-medium text-neutral-300 hover:text-neutral-50">
          Entrar
        </a>
      </nav>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 pb-16 pt-8 md:grid-cols-2 md:items-center md:pb-24">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-50 sm:text-4xl">
            Aprenda SQL e MER na prática
          </h1>
          <p className="mt-4 max-w-md text-base text-neutral-300">
            Editor de consultas, modelagem de diagrama entidade-relacionamento e sandbox de banco de dados isolado,
            lado a lado — com correção automática e dicas de IA sob medida pra cada exercício.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#acesso"
              className="inline-flex items-center justify-center rounded-md bg-primary-500 px-4 py-2 text-sm
                font-medium text-neutral-900 transition-colors hover:bg-primary-100"
            >
              Entrar
            </a>
            <Link
              to="/registro"
              className="inline-flex items-center justify-center rounded-md border border-neutral-700 px-4 py-2
                text-sm font-medium text-neutral-50 transition-colors hover:border-neutral-300"
            >
              Criar conta de aluno →
            </Link>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="rounded-md border border-neutral-800 bg-neutral-950/60 p-4 font-mono text-xs text-neutral-300 shadow-2xl"
        >
          <p className="text-neutral-500">-- resultado da consulta do exercício</p>
          <p className="mt-2">
            <span className="text-primary-100">SELECT</span> turma.nome, <span className="text-primary-100">COUNT</span>
            (aluno.id)
          </p>
          <p>
            <span className="text-primary-100">FROM</span> turma
          </p>
          <p>
            <span className="text-primary-100">JOIN</span> aluno <span className="text-primary-100">ON</span>{' '}
            aluno.turma_id = turma.id
          </p>
          <p>
            <span className="text-primary-100">GROUP BY</span> turma.nome;
          </p>
          <p className="mt-3 text-neutral-500">✓ 3 linhas — dentro do esperado</p>
        </div>
      </div>
    </header>
  )
}

export default HeroLanding
