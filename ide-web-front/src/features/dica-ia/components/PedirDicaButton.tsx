import type { ReactNode } from 'react'
import { Button } from '~components/Button/Button'
import { Modal } from '~components/Modal/Modal'
import { usePedirDica } from '../hooks/usePedirDica'
import type { ContextoDica, EstadoDica } from '../types'

const HTTP_CONFLICT = 409
const HTTP_SERVICE_UNAVAILABLE = 503
// Ambiente sem chave de IA (LLM_NAO_CONFIGURADO) não se resolve tentando de novo — é
// diferente do 503 passageiro do provedor, em que o botão continua valendo a pena.
const CODIGO_IA_SEM_CONFIGURACAO = 'LLM_NAO_CONFIGURADO'

const MENSAGENS_ERRO: Record<number, string> = {
  [HTTP_SERVICE_UNAVAILABLE]: 'Serviço de dicas indisponível no momento, tente novamente em instantes.',
}

const ROTULOS_CONTEXTO: Record<ContextoDica, string> = {
  sql: 'Pedir dica (SQL)',
  mer: 'Pedir dica (MER)',
}

interface PedirDicaButtonProps {
  exercicioId: string
  contexto: ContextoDica
  estado: EstadoDica
  // Quem renderiza sabe se a parte pedida está vazia (SQL em branco, diagrama sem entidade).
  semConteudo: boolean
}

export const PedirDicaButton = ({ exercicioId, contexto, estado, semConteudo }: PedirDicaButtonProps): ReactNode => {
  const { pedir, isPending, dica, fecharDica, quotaAtingida, erro } = usePedirDica(exercicioId, contexto)

  const iaSemConfiguracao = erro?.code === CODIGO_IA_SEM_CONFIGURACAO
  const mensagemErro = ((): string | null => {
    if (!erro || erro.status === HTTP_CONFLICT) return null
    if (iaSemConfiguracao) return 'As dicas de IA não estão ativas neste ambiente — siga sem elas ou fale com o professor.'
    return MENSAGENS_ERRO[erro.status] ?? 'Não foi possível gerar a dica agora.'
  })()

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Button
        variant="ghost"
        onClick={() => { pedir(estado) }}
        disabled={isPending || quotaAtingida || semConteudo || iaSemConfiguracao}
        title={iaSemConfiguracao ? 'Dicas de IA não configuradas neste ambiente' : undefined}
      >
        {ROTULOS_CONTEXTO[contexto]}
      </Button>
      {isPending ? (
        <p aria-live="polite" className="text-xs text-neutral-600">
          Processando dica, aguarde...
        </p>
      ) : null}
      {quotaAtingida ? (
        <p role="alert" className="text-xs text-danger-500">
          Limite de dicas atingido para esta parte do exercício.
        </p>
      ) : null}
      {mensagemErro ? (
        <p role="alert" className="text-xs text-danger-500">
          {mensagemErro}
        </p>
      ) : null}
      <Modal title="Dica" isOpen={dica !== null} onClose={fecharDica}>
        <p className="text-sm text-neutral-800">{dica?.respostaIa}</p>
      </Modal>
    </div>
  )
}

export default PedirDicaButton
