import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ROTULO_ESTADO } from '../types'
import type { EstadoCelula, ExercicioDoAluno } from '../types'

const ESTILO_ESTADO: Record<EstadoCelula, string> = {
  nao_iniciou: 'bg-neutral-100 text-neutral-700',
  em_andamento: 'bg-primary-50 text-primary-700',
  entregue: 'bg-neutral-100 text-neutral-800',
  correto: 'bg-success-50 text-success-700',
  aguardando_revisao: 'bg-primary-100 text-primary-700',
}

interface ListaExerciciosProps {
  exercicios: ExercicioDoAluno[]
  mostrarTurma?: boolean
  vazio: string
}

export const ListaExercicios = ({ exercicios, mostrarTurma = false, vazio }: ListaExerciciosProps): ReactNode => {
  if (exercicios.length === 0) {
    return <p className="text-sm text-neutral-600">{vazio}</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {exercicios.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-neutral-200 p-3"
        >
          <div>
            <Link to={`/exercicios/${item.id}`} className="text-sm font-medium text-primary-600 hover:underline">
              {item.titulo}
            </Link>
            <p className="mt-0.5 text-xs text-neutral-600">
              {mostrarTurma ? `${item.turmaNome} · ${item.disciplina} · ` : ''}
              {item.nivelDificuldade === 'iniciante' ? 'Iniciante' : 'Intermediário'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs ${ESTILO_ESTADO[item.estado]}`}>
              {ROTULO_ESTADO[item.estado]}
            </span>
            {item.gabaritoLiberado ? (
              <Link
                to={`/exercicios/${item.id}/resultado`}
                className="text-xs font-medium text-primary-600 hover:underline"
              >
                Ver resultado
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
