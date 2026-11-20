import { useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '~components/Button/Button'
// Import direto (não pelo barrel `~features/exercicio`), que puxaria a ExercicioPage com o Monaco.
import { exercicioService } from '~features/exercicio/services/exercicioService'
import type { ExercicioAluno } from '~features/exercicio/types'
import { MINHA_PARTICIPACAO_QUERY_KEY } from '../hooks/useMinhaParticipacao'

interface ControleEntregaProps {
  exercicio: ExercicioAluno
  /** Entrega já registrada no servidor (`minha-participacao`), em qualquer navegador. */
  entregue: boolean
}

/**
 * Grupo controle: resolve o exercício nas ferramentas tradicionais (pgAdmin, editor de
 * diagrama) e entrega aqui só a consulta final, que é corrigida no sandbox pra taxa de
 * acerto ser comparável entre os grupos. O aluno não vê se acertou — nas ferramentas
 * tradicionais ele também não teria esse retorno. A entrega é única, e quem garante é
 * o servidor (`EntregaUnicaDoControle`); até 16/11/2026 ela ficava só no localStorage.
 */
export const ControleEntrega = ({ exercicio, entregue }: ControleEntregaProps): ReactNode => {
  const queryClient = useQueryClient()
  const [sql, setSql] = useState('')
  const [copiado, setCopiado] = useState(false)

  const entregarMutation = useMutation({
    mutationFn: () => exercicioService.enviarSql(exercicio.id, sql),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MINHA_PARTICIPACAO_QUERY_KEY }),
  })

  const copiarScript = (): void => {
    if (!exercicio.sqlSetup) return
    void navigator.clipboard.writeText(exercicio.sqlSetup).then(() => { setCopiado(true) })
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3">
      <p className="text-sm font-medium text-neutral-900">{exercicio.titulo}</p>
      <p className="text-sm text-neutral-700">{exercicio.enunciado}</p>

      {exercicio.temMer ? (
        <p className="text-xs text-neutral-600">
          Parte de modelagem (MER): desenhe na ferramenta de diagrama indicada pelo pesquisador e entregue conforme a
          orientação dele.
        </p>
      ) : null}

      {exercicio.temSql ? (
        <>
          {exercicio.sqlSetup ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={copiarScript}>
                Copiar script de dados
              </Button>
              <span className="text-xs text-neutral-600">
                {copiado ? 'Copiado! Cole no pgAdmin/psql para criar as tabelas.' : 'Para carregar os dados no pgAdmin/psql.'}
              </span>
            </div>
          ) : null}

          {entregue || entregarMutation.isSuccess ? (
            <p role="status" className="text-sm font-medium text-neutral-900">
              Resposta registrada.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor={`entrega-${exercicio.id}`} className="text-sm font-medium text-neutral-900">
                Cole sua consulta SQL final
              </label>
              <textarea
                id={`entrega-${exercicio.id}`}
                value={sql}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => { setSql(event.target.value) }}
                className="min-h-24 rounded-md border border-neutral-300 p-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              />
              <p className="text-xs text-neutral-600">A entrega é única — confira antes de enviar.</p>
              {entregarMutation.isError ? (
                <p role="alert" className="text-sm text-danger-500">
                  {entregarMutation.error.message}
                </p>
              ) : null}
              <Button
                isLoading={entregarMutation.isPending}
                disabled={sql.trim().length === 0}
                onClick={() => { entregarMutation.mutate() }}
              >
                Entregar consulta
              </Button>
            </div>
          )}
        </>
      ) : null}
    </li>
  )
}

export default ControleEntrega
