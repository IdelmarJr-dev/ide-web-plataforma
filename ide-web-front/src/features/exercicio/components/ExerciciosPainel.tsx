import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '~components/Button/Button'
import { Modal } from '~components/Modal/Modal'
import { parseDocumento } from '../modelagem/documento'
import type { DocumentoModelagem, ModoModelagem } from '../modelagem/documento'
import { exercicioService } from '../services/exercicioService'
import type { ExercicioAluno, ExercicioProfessor } from '../types'
import { CriarExercicioForm } from './CriarExercicioForm'
import { GabaritoModelagemModal } from './modelagem/GabaritoModelagemModal'

interface ExerciciosPainelProps {
  turmaId: string
}

function ehExercicioProfessor(exercicio: ExercicioAluno | ExercicioProfessor): exercicio is ExercicioProfessor {
  return 'merGabarito' in exercicio
}

export const ExerciciosPainel = ({ turmaId }: ExerciciosPainelProps): ReactNode => {
  const queryClient = useQueryClient()
  const queryKey = ['turmas', turmaId, 'exercicios']

  const exerciciosQuery = useQuery({
    queryKey,
    queryFn: () => exercicioService.listarPorTurma(turmaId),
  })

  const [exercicioEditandoMer, setExercicioEditandoMer] = useState<ExercicioProfessor | null>(null)
  // Liberar o gabarito mostra as respostas pra turma inteira: confirma antes.
  const [exercicioLiberando, setExercicioLiberando] = useState<ExercicioAluno | ExercicioProfessor | null>(null)

  const atualizarMerMutation = useMutation({
    mutationFn: ({ id, documento, modo }: { id: string; documento: DocumentoModelagem; modo: ModoModelagem }) =>
      exercicioService.atualizar(id, { merGabarito: documento, modoMer: modo }),
    onSuccess: () => {
      setExercicioEditandoMer(null)
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  const liberarMutation = useMutation({
    mutationFn: ({ id, liberado }: { id: string; liberado: boolean }) =>
      liberado ? exercicioService.liberarGabarito(id) : exercicioService.ocultarGabarito(id),
    onSuccess: () => {
      setExercicioLiberando(null)
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <details>
        <summary className="cursor-pointer text-sm font-medium text-neutral-900">Novo exercício</summary>
        <div className="mt-3">
          <CriarExercicioForm turmaId={turmaId} />
        </div>
      </details>

      {exerciciosQuery.isLoading ? <p className="text-sm text-neutral-600">Carregando exercícios…</p> : null}

      {exerciciosQuery.data && exerciciosQuery.data.length === 0 ? (
        <p className="text-sm text-neutral-600">Nenhum exercício cadastrado ainda.</p>
      ) : null}

      {exerciciosQuery.data && exerciciosQuery.data.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {exerciciosQuery.data.map((exercicio) => (
            <li key={exercicio.id} className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 p-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">{exercicio.titulo}</p>
                <p className="text-xs text-neutral-600">
                  {exercicio.gabaritoLiberado ? 'Gabarito liberado' : 'Gabarito não liberado'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {ehExercicioProfessor(exercicio) ? (
                  <Button
                    variant="ghost"
                    onClick={() => { setExercicioEditandoMer(exercicio) }}
                  >
                    {exercicio.temMer ? 'Editar modelagem' : 'Adicionar modelagem'}
                  </Button>
                ) : null}
                <Link
                  to={`/admin/turmas/${turmaId}/exercicios/${exercicio.id}/revisar`}
                  className="text-sm font-medium text-primary-600 hover:underline"
                >
                  Revisar
                </Link>
                {exercicio.gabaritoLiberado ? (
                  <Button
                    variant="ghost"
                    isLoading={liberarMutation.isPending && liberarMutation.variables.id === exercicio.id}
                    onClick={() => {
                      liberarMutation.mutate({ id: exercicio.id, liberado: false })
                    }}
                  >
                    Ocultar gabarito
                  </Button>
                ) : (
                  <Button onClick={() => { setExercicioLiberando(exercicio) }}>Liberar gabarito</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {exercicioLiberando ? (
        <Modal title="Liberar o gabarito?" isOpen onClose={() => { setExercicioLiberando(null) }}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-neutral-700">
              Todos os alunos da turma passam a ver o gabarito de <strong>{exercicioLiberando.titulo}</strong> assim que
              você confirmar. Dá para ocultar de novo depois, mas quem já tiver visto não desvê.
            </p>
            {liberarMutation.isError ? (
              <p role="alert" className="text-sm text-danger-500">{liberarMutation.error.message}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setExercicioLiberando(null) }}>
                Cancelar
              </Button>
              <Button
                isLoading={liberarMutation.isPending}
                onClick={() => { liberarMutation.mutate({ id: exercicioLiberando.id, liberado: true }) }}
              >
                Liberar gabarito
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {exercicioEditandoMer ? (
        <GabaritoModelagemModal
          documentoInicial={parseDocumento(exercicioEditandoMer.merGabarito)}
          modoInicial={exercicioEditandoMer.modoMer}
          isSalvando={atualizarMerMutation.isPending}
          erro={atualizarMerMutation.isError ? atualizarMerMutation.error.message : null}
          onClose={() => { setExercicioEditandoMer(null) }}
          onSalvar={({ documento, modo }) => {
            atualizarMerMutation.mutate({ id: exercicioEditandoMer.id, documento, modo })
          }}
        />
      ) : null}
    </div>
  )
}

export default ExerciciosPainel
