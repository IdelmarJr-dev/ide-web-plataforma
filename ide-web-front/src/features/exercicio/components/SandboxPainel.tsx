import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '~components/Button/Button'
import { Modal } from '~components/Modal/Modal'
import { HttpError } from '../../../lib/httpClient'
import { exercicioService } from '../services/exercicioService'
import type { SandboxEnvioResultado, SandboxResultado } from '../types'
import { PlanoExecucao } from './PlanoExecucao'

interface SandboxPainelProps {
  exercicioId: string
  sql: string
  /** Questão de prova: sem testar, e o envio é único (Fase 10, D9 e D10). */
  ehProva?: boolean
}

function ResultadoTabela({ rows }: { rows: Record<string, unknown>[] }): ReactNode {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-600">A consulta não retornou linhas.</p>
  }

  const colunas = Object.keys(rows[0] ?? {})

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr>
            {colunas.map((coluna) => (
              <th key={coluna} className="border-b border-neutral-300 px-2 py-1 font-medium text-neutral-900">
                {coluna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {colunas.map((coluna) => (
                <td key={coluna} className="border-b border-neutral-100 px-2 py-1 text-neutral-700">
                  {String(row[coluna])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Veredito do envio. `correta` nula quer dizer que o exercício não tem gabarito SQL: antes
 * isso não mostrava nada, e o aluno lia "rodou sem erro" como "acertei" (Fase 9, D15).
 */
function VereditoEnvio({ correta }: { correta: boolean | null }): ReactNode {
  if (correta === null) {
    return (
      <p className="text-sm font-medium text-neutral-700">
        Resposta enviada. Este exercício será corrigido pelo professor.
      </p>
    )
  }

  return (
    <p className={`text-sm font-medium ${correta ? 'text-success-700' : 'text-danger-500'}`}>
      {correta ? 'Resposta correta.' : 'Resposta incorreta.'}
    </p>
  )
}

const HTTP_ERRO_SERVIDOR = 500

/**
 * Recusa do servidor (prazo, turma encerrada, envio único já usado) traz a regra em
 * português e é mostrada como veio; falha do servidor e falta de conexão ganham orientação
 * própria. Antes, nenhuma delas aparecia: o botão simplesmente não fazia nada.
 */
function mensagemDeFalha(erro: Error): string {
  if (erro instanceof HttpError) {
    const texto = /[.!?]$/.test(erro.message) ? erro.message : `${erro.message}.`
    return erro.status >= HTTP_ERRO_SERVIDOR ? `${texto} O problema é no servidor: tente de novo em instantes.` : texto
  }
  return 'Sem conexão com o servidor. Confira a internet e tente de novo.'
}

/** Exportado porque o estudo livre mostra o resultado do mesmo jeito (Fase 8). */
export function ResultadoSandbox({ resultado }: { resultado: SandboxResultado | SandboxEnvioResultado }): ReactNode {
  if (resultado.status !== 'sucesso') {
    return (
      <p role="alert" className="text-sm text-danger-500">
        {resultado.message ?? 'Erro ao executar a consulta.'}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {'correta' in resultado ? <VereditoEnvio correta={resultado.correta} /> : null}
      <ResultadoTabela rows={resultado.rows ?? []} />
      {'plano' in resultado ? <PlanoExecucao plano={resultado.plano} /> : null}
    </div>
  )
}

export const SandboxPainel = ({ exercicioId, sql, ehProva = false }: SandboxPainelProps): ReactNode => {
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false)
  const testarMutation = useMutation({
    mutationFn: () => exercicioService.testarSql(exercicioId, sql),
  })

  const enviarMutation = useMutation({
    mutationFn: () => exercicioService.enviarSql(exercicioId, sql),
  })

  const resultado = enviarMutation.data ?? testarMutation.data
  const falha = enviarMutation.error ?? testarMutation.error
  // Em prova, o envio único já foi gasto nesta tela: o botão para de aceitar clique.
  const envioDeProvaUsado = ehProva && enviarMutation.isSuccess

  return (
    <div className="flex max-h-[45vh] shrink-0 flex-col gap-3 overflow-auto rounded-md border border-neutral-300 bg-surface p-3">
      {ehProva ? (
        <p className="rounded-md border border-primary-500 bg-primary-50 p-2 text-xs text-neutral-800">
          Questão de prova: você não pode testar a consulta, e o envio é único.
        </p>
      ) : null}

      <div className="flex gap-3">
        {/* D9: em prova, testar transformaria a avaliação num exercício comum. */}
        {ehProva ? null : (
          <Button
            variant="ghost"
            isLoading={testarMutation.isPending}
            onClick={() => {
              enviarMutation.reset()
              testarMutation.mutate()
            }}
          >
            Testar
          </Button>
        )}
        <Button
          isLoading={enviarMutation.isPending}
          disabled={envioDeProvaUsado}
          onClick={() => {
            if (ehProva) {
              setConfirmandoEnvio(true)
              return
            }
            testarMutation.reset()
            enviarMutation.mutate()
          }}
        >
          Enviar resposta
        </Button>
      </div>
      {envioDeProvaUsado ? (
        <p className="text-xs text-neutral-700">
          Seu envio foi registrado. Se precisar de outro, peça ao professor para liberar um novo envio.
        </p>
      ) : null}
      {falha ? (
        <p role="alert" className="text-sm text-danger-500">
          {mensagemDeFalha(falha)}
        </p>
      ) : null}
      {resultado && !falha ? <ResultadoSandbox resultado={resultado} /> : null}

      {/* D10: o envio consome a tentativa mesmo se falhar — o aviso precisa ser explícito. */}
      <Modal
        title="Enviar esta resposta?"
        isOpen={confirmandoEnvio}
        onClose={() => {
          setConfirmandoEnvio(false)
        }}
      >
        <p className="text-sm text-neutral-700">
          Esta é uma questão de prova: você tem <strong>um único envio</strong>. Depois de enviar, não dá para
          corrigir — nem se a consulta tiver um erro de digitação. Confira antes de confirmar.
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            isLoading={enviarMutation.isPending}
            onClick={() => {
              setConfirmandoEnvio(false)
              enviarMutation.mutate()
            }}
          >
            Enviar definitivamente
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirmandoEnvio(false)
            }}
          >
            Revisar mais
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default SandboxPainel
