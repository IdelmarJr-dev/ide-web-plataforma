import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { TurmaDoPainel } from '../types'

function formatarData(iso: string | null): string {
  if (iso === null) return 'sem atividade ainda'
  return `última atividade em ${new Date(iso).toLocaleDateString('pt-BR')}`
}

export const CartaoTurma = ({ turma }: { turma: TurmaDoPainel }): ReactNode => {
  // O total de entregas possíveis é alunos × exercícios; sem um dos dois não há barra.
  const possiveis = turma.alunos * turma.exercicios
  const progresso = possiveis === 0 ? 0 : Math.round((turma.entregas / possiveis) * 100)

  return (
    <li className="rounded-lg border border-neutral-300 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold text-neutral-900">{turma.nome}</h3>
        {turma.encerradaEm === null ? null : (
          <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-700">Encerrada</span>
        )}
      </div>
      <p className="mt-1 text-sm text-neutral-600">
        {turma.disciplina} — {turma.semestre} · código <strong>{turma.codigo}</strong>
      </p>

      <p className="mt-3 text-xs text-neutral-600">
        {turma.alunos} {turma.alunos === 1 ? 'aluno' : 'alunos'} · {turma.exercicios}{' '}
        {turma.exercicios === 1 ? 'exercício' : 'exercícios'} · {formatarData(turma.ultimaAtividadeEm)}
      </p>

      {possiveis === 0 ? null : (
        <div className="mt-2">
          <div
            role="progressbar"
            aria-valuenow={progresso}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Entregas em ${turma.nome}`}
            className="h-2 overflow-hidden rounded-full bg-neutral-100"
          >
            <div className="h-full bg-primary-500" style={{ width: `${progresso}%` }} />
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            {turma.entregas} de {possiveis} entregas ({progresso}%)
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link to={`/admin/turmas/${turma.id}/painel`} className="text-sm font-medium text-primary-600 hover:underline">
          Ver a matriz da turma
        </Link>
        {turma.aguardandoRevisao > 0 ? (
          <span className="text-xs text-neutral-700">
            {turma.aguardandoRevisao} {turma.aguardandoRevisao === 1 ? 'entrega espera' : 'entregas esperam'} correção
          </span>
        ) : null}
      </div>
    </li>
  )
}
