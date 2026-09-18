import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePainelProfessor } from '../hooks/usePainel'
import { CartaoResumo } from './CartaoResumo'
import { CartaoTurma } from './CartaoTurma'
import { FilaCorrecao } from './FilaCorrecao'
import { aplicarFiltro, FILTRO_VAZIO } from '../filtroTurmas'
import type { FiltroTurmasValor } from '../filtroTurmas'
import { FiltroTurmas } from './FiltroTurmas'

export const PainelProfessor = (): ReactNode => {
  const painelQuery = usePainelProfessor()
  const [filtro, setFiltro] = useState<FiltroTurmasValor>(FILTRO_VAZIO)

  if (painelQuery.isLoading) {
    return <p className="text-sm text-neutral-600">Carregando seu painel…</p>
  }

  if (painelQuery.isError) {
    return (
      <p role="alert" className="text-sm text-danger-500">
        {painelQuery.error.message}
      </p>
    )
  }

  const painel = painelQuery.data
  if (!painel) return null

  if (painel.turmas.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-300 p-6">
        <h2 className="text-base font-semibold text-neutral-900">Você ainda não tem turmas</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Crie uma turma e compartilhe o código com seus alunos. O painel se enche sozinho conforme eles entregam.
        </p>
        <Link
          to="/admin/turmas"
          className="mt-3 inline-block text-sm font-medium text-primary-600 hover:underline"
        >
          Criar minha primeira turma
        </Link>
      </div>
    )
  }

  const turmasFiltradas = aplicarFiltro(painel.turmas, filtro)

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Resumo">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CartaoResumo rotulo="Turmas ativas" valor={painel.resumo.turmasAtivas} />
          <CartaoResumo rotulo="Alunos matriculados" valor={painel.resumo.alunos} />
          <CartaoResumo rotulo="Exercícios publicados" valor={painel.resumo.exercicios} />
          <CartaoResumo rotulo="Aguardando sua correção" valor={painel.resumo.aguardandoRevisao} destaque />
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-neutral-900">Esperando correção</h2>
        <div className="mt-2">
          <FilaCorrecao turmas={painel.turmas} />
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-neutral-900">Minhas turmas</h2>
          {/* A lista é onde se AGE (criar, encerrar, cadastrar); o painel é onde se VÊ. */}
          <Link to="/admin/turmas" className="text-sm font-medium text-primary-600 hover:underline">
            Gerenciar turmas
          </Link>
        </div>
        <div className="mt-3">
          <FiltroTurmas turmas={painel.turmas} valor={filtro} onChange={setFiltro} />
        </div>
        {turmasFiltradas.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">Nenhuma turma corresponde ao filtro.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {turmasFiltradas.map((turma) => (
              <CartaoTurma key={turma.id} turma={turma} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
