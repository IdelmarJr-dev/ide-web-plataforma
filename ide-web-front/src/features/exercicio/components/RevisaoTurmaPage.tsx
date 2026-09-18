import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { turmasService } from '~features/turmas/services/turmasService'
import { exercicioService } from '../services/exercicioService'

export const RevisaoTurmaPage = (): ReactNode => {
  const { turmaId, exercicioId } = useParams<{ turmaId: string; exercicioId: string }>()

  const exercicioQuery = useQuery({
    queryKey: ['exercicios', exercicioId],
    queryFn: () => exercicioService.buscarPorId(exercicioId ?? ''),
    enabled: exercicioId !== undefined,
  })

  const alunosQuery = useQuery({
    queryKey: ['turmas', turmaId, 'alunos'],
    queryFn: () => turmasService.listarAlunos(turmaId ?? ''),
    enabled: turmaId !== undefined,
  })

  return (
    <div className="flex flex-col gap-4 p-6">
      <header>
        <Link to="/admin/turmas" className="text-sm font-medium text-primary-600 hover:underline">
          ← Voltar às turmas
        </Link>
        <h1 className="mt-3 text-lg font-semibold text-neutral-900">
          Revisar {exercicioQuery.data ? `— ${exercicioQuery.data.titulo}` : ''}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">Escolha um aluno para revisar o resultado deste exercício.</p>
      </header>

      {alunosQuery.isLoading ? <p className="text-sm text-neutral-600">Carregando alunos…</p> : null}

      {alunosQuery.data && alunosQuery.data.length === 0 ? (
        <p className="text-sm text-neutral-600">Esta turma ainda não tem alunos matriculados.</p>
      ) : null}

      {alunosQuery.data && alunosQuery.data.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {alunosQuery.data.map((aluno) => (
            <li key={aluno.id} className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 p-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">{aluno.nome}</p>
                <p className="text-xs text-neutral-600">{aluno.email}</p>
              </div>
              <Link
                to={`/admin/turmas/${turmaId}/exercicios/${exercicioId}/revisar/${aluno.id}`}
                className="text-sm font-medium text-primary-600 hover:underline"
              >
                Revisar
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default RevisaoTurmaPage
