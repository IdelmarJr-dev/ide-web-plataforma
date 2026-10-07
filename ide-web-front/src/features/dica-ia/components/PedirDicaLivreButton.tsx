import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '~components/Button/Button'
import { Modal } from '~components/Modal/Modal'
import { usePedirDicaLivre } from '../hooks/usePedirDicaLivre'

const HTTP_TOO_MANY_REQUESTS = 429
const HTTP_SERVICE_UNAVAILABLE = 503
const CODIGO_IA_SEM_CONFIGURACAO = 'LLM_NAO_CONFIGURADO'

interface PedirDicaLivreButtonProps {
  sql: string
}

/**
 * Dica de IA pro estudo livre (banco sem exercício, Fase 8 + relatório de testes
 * 2026-10): diferente do `PedirDicaButton` (preso a um exercício), aqui o aluno conta
 * em texto livre o que está tentando fazer, já que não há enunciado/gabarito por trás.
 */
export const PedirDicaLivreButton = ({ sql }: PedirDicaLivreButtonProps): ReactNode => {
  const [aberto, setAberto] = useState(false)
  const [objetivo, setObjetivo] = useState('')
  const { pedir, isPending, respostaIa, fecharDica, erro } = usePedirDicaLivre()

  const iaSemConfiguracao = erro?.code === CODIGO_IA_SEM_CONFIGURACAO
  const mensagemErro = ((): string | null => {
    if (!erro) return null
    if (iaSemConfiguracao) return 'As dicas de IA não estão ativas neste ambiente — siga sem elas ou fale com o professor.'
    if (erro.status === HTTP_TOO_MANY_REQUESTS) return 'Muitos pedidos de dica em pouco tempo — espere um pouco e tente de novo.'
    if (erro.status === HTTP_SERVICE_UNAVAILABLE) return 'Serviço de dicas indisponível no momento, tente novamente em instantes.'
    return 'Não foi possível gerar a dica agora.'
  })()

  const fechar = (): void => {
    setAberto(false)
    setObjetivo('')
    fecharDica()
  }

  return (
    <>
      <Button
        variant="ghost"
        disabled={sql.trim() === ''}
        title={sql.trim() === '' ? 'Escreva algo no banco antes de pedir dica' : undefined}
        onClick={() => {
          setAberto(true)
        }}
      >
        Pedir dica
      </Button>

      <Modal title="Dica" isOpen={aberto} onClose={fechar}>
        {respostaIa ? (
          <>
            <p className="text-sm text-neutral-800">{respostaIa}</p>
            <div className="mt-4">
              <Button variant="ghost" onClick={fechar}>
                Fechar
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-900">
              O que você está tentando fazer?
              <textarea
                value={objetivo}
                onChange={(event) => {
                  setObjetivo(event.target.value)
                }}
                rows={3}
                className="rounded-md border border-neutral-300 p-2 text-sm text-neutral-800"
                placeholder="Ex.: queria listar os clientes que nunca compraram nada"
              />
            </label>
            <div className="flex items-center gap-2">
              <Button
                isLoading={isPending}
                loadingLabel="Gerando dica…"
                disabled={isPending || iaSemConfiguracao}
                title={iaSemConfiguracao ? 'Dicas de IA não configuradas neste ambiente' : undefined}
                onClick={() => {
                  const objetivoTrim = objetivo.trim()
                  pedir(objetivoTrim === '' ? { sql } : { sql, objetivo: objetivoTrim })
                }}
              >
                Gerar dica
              </Button>
            </div>
            {mensagemErro ? (
              <p role="alert" className="text-xs text-danger-500">
                {mensagemErro}
              </p>
            ) : null}
          </div>
        )}
      </Modal>
    </>
  )
}

export default PedirDicaLivreButton
