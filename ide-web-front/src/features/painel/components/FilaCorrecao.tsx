import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { TurmaDoPainel } from '../types'

/**
 * Só o que exige correção humana (modelagem e dissertativa). Exercício público e
 * correção automática de SQL não entram — ver Fase 9, D4.
 */
export const FilaCorrecao = ({ turmas }: { turmas: TurmaDoPainel[] }): ReactNode => {
  const pendentes = turmas.filter((turma) => turma.aguardandoRevisao > 0)

  if (pendentes.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Nada aguardando correção manual. Entregas de SQL com gabarito são corrigidas sozinhas.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {pendentes.map((turma) => (
        <li
          key={turma.id}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-neutral-300 p-3"
        >
          <div>
            <span className="text-sm font-medium text-neutral-900">{turma.nome}</span>
            <span className="ml-2 text-xs text-neutral-600">{turma.disciplina}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-700">
              {turma.aguardandoRevisao} {turma.aguardandoRevisao === 1 ? 'entrega' : 'entregas'}
            </span>
            <Link
              to={`/admin/turmas/${turma.id}/painel`}
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              Corrigir
            </Link>
          </div>
        </li>
      ))}
    </ul>
  )
}
