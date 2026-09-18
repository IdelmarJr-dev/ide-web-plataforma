import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { exercicioService } from '../services/exercicioService'

interface ExerciciosAlunoListProps {
  turmaId: string
}

export const ExerciciosAlunoList = ({ turmaId }: ExerciciosAlunoListProps): ReactNode => {
  const exerciciosQuery = useQuery({
    queryKey: ['turmas', turmaId, 'exercicios'],
    queryFn: () => exercicioService.listarPorTurma(turmaId),
  })

  if (exerciciosQuery.isLoading) {
    return <p className="text-sm text-neutral-600">Carregando exercícios…</p>
  }

  const exercicios = exerciciosQuery.data ?? []

  if (exercicios.length === 0) {
    return <p className="text-sm text-neutral-600">Nenhum exercício disponível ainda.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {exercicios.map((exercicio) => (
        <li key={exercicio.id} className="rounded-md border border-neutral-200 p-3">
          <Link to={`/exercicios/${exercicio.id}`} className="text-sm font-medium text-primary-600 hover:underline">
            {exercicio.titulo}
          </Link>
          {exercicio.gabaritoLiberado ? (
            <Link to={`/exercicios/${exercicio.id}/resultado`} className="ml-3 text-xs text-neutral-600 hover:underline">
              ver resultado
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export default ExerciciosAlunoList
