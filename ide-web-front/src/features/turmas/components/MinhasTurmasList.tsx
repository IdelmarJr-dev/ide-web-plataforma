import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '~components/Button/Button'
import { Modal } from '~components/Modal/Modal'
import { ExerciciosPainel, ProvasPainel } from '~features/exercicio'
import { TURMAS_QUERY_KEY } from '../hooks/queryKeys'
import { turmasService } from '../services/turmasService'
import type { Turma } from '../types'

export const MinhasTurmasList = (): ReactNode => {
  const queryClient = useQueryClient()
  const [turmaParaEncerrar, setTurmaParaEncerrar] = useState<Turma | null>(null)

  const turmasQuery = useQuery({
    queryKey: TURMAS_QUERY_KEY,
    queryFn: turmasService.minhas,
  })

  const encerramentoMutation = useMutation({
    mutationFn: ({ id, encerrar }: { id: string; encerrar: boolean }) =>
      encerrar ? turmasService.encerrar(id) : turmasService.reabrir(id),
    onSuccess: () => {
      setTurmaParaEncerrar(null)
      void queryClient.invalidateQueries({ queryKey: TURMAS_QUERY_KEY })
    },
  })

  if (turmasQuery.isLoading) {
    return <p className="text-sm text-neutral-600">Carregando turmas…</p>
  }

  if (turmasQuery.isError) {
    return (
      <p role="alert" className="text-sm text-danger-500">
        {turmasQuery.error.message}
      </p>
    )
  }

  const turmas = turmasQuery.data ?? []

  if (turmas.length === 0) {
    return <p className="text-sm text-neutral-600">Você ainda não criou nenhuma turma.</p>
  }

  return (
    <>
      <ul className="flex flex-col gap-6">
      {turmas.map((turma) => (
        <li key={turma.id} className="rounded-md border border-neutral-200 p-4">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-base font-semibold text-neutral-900">{turma.nome}</h3>
            <span className="text-sm text-neutral-600">
              Código: <strong>{turma.codigo}</strong>
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            {turma.disciplina} — {turma.semestre}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {turma.encerradaEm === null ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setTurmaParaEncerrar(turma)
                }}
              >
                Encerrar turma
              </Button>
            ) : (
              <>
                <span className="text-xs text-neutral-600">Turma encerrada. Os alunos continuam vendo tudo o que entregaram, mas não enviam mais nada e o código não matricula ninguém.</span>
                <Button
                  variant="ghost"
                  isLoading={encerramentoMutation.isPending && encerramentoMutation.variables.id === turma.id}
                  onClick={() => {
                    encerramentoMutation.mutate({ id: turma.id, encerrar: false })
                  }}
                >
                  Reabrir
                </Button>
              </>
            )}
          </div>
          <div className="mt-4">
            <ProvasPainel turmaId={turma.id} />
          </div>
          <div className="mt-4">
            <ExerciciosPainel turmaId={turma.id} />
          </div>
        </li>
        ))}
      </ul>

      <Modal
        title="Encerrar a turma?"
        isOpen={turmaParaEncerrar !== null}
        onClose={() => {
          setTurmaParaEncerrar(null)
        }}
      >
        <p className="text-sm text-neutral-700">
          Os alunos de {turmaParaEncerrar?.nome} continuam vendo a turma e o que entregaram, mas param de enviar
          respostas, e o código deixa de matricular gente nova. Dá pra reabrir depois.
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            isLoading={encerramentoMutation.isPending}
            loadingLabel="Encerrando…"
            onClick={() => {
              if (turmaParaEncerrar) encerramentoMutation.mutate({ id: turmaParaEncerrar.id, encerrar: true })
            }}
          >
            Encerrar
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setTurmaParaEncerrar(null)
            }}
          >
            Cancelar
          </Button>
        </div>
      </Modal>
    </>
  )
}

export default MinhasTurmasList
