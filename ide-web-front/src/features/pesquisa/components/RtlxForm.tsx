import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '~components/Button/Button'
import { MINHA_PARTICIPACAO_QUERY_KEY, useMinhaParticipacao } from '../hooks/useMinhaParticipacao'
import { pesquisaService } from '../services/pesquisaService'
import { RTLX_DIMENSOES, RTLX_MAX, RTLX_MIN, RTLX_PASSO, calcularPontuacaoRtlx } from '../utils/rtlxScore'

// As 21 marcas da escala original do NASA-TLX (0, 5, …, 100). Botões em vez de slider:
// slider sempre começa em algum valor e ancora a resposta; aqui nada vem pré-marcado.
const MARCAS = Array.from({ length: (RTLX_MAX - RTLX_MIN) / RTLX_PASSO + 1 }, (_, indice) => RTLX_MIN + indice * RTLX_PASSO)

export const RtlxForm = (): ReactNode => {
  const queryClient = useQueryClient()
  const { data: participacao, isLoading } = useMinhaParticipacao()
  const [dimensoes, setDimensoes] = useState<Record<string, number>>({})
  const sessao = participacao?.sessao

  const enviarMutation = useMutation({
    mutationFn: () => {
      if (!sessao) throw new Error('Sessão não encontrada')
      return pesquisaService.enviarRtlx(sessao.id, dimensoes, calcularPontuacaoRtlx(dimensoes))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MINHA_PARTICIPACAO_QUERY_KEY }),
  })

  const completo = RTLX_DIMENSOES.every((dimensao) => dimensoes[dimensao.chave] !== undefined)

  const handleSubmit = useCallback(() => {
    if (!completo) return
    enviarMutation.mutate()
  }, [completo, enviarMutation])

  if (enviarMutation.isSuccess) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-neutral-900">Obrigado por participar!</p>
        <p className="text-sm text-neutral-600">Suas respostas foram registradas.</p>
        <Link to="/dashboard" className="mt-2 text-sm font-medium text-primary-600 hover:underline">
          Voltar ao painel
        </Link>
      </div>
    )
  }

  if (isLoading) {
    return <p className="text-sm text-neutral-600">Carregando…</p>
  }

  if (!sessao?.finalizadaEm || !participacao?.susRespondido || participacao.rtlxRespondido) {
    return (
      <p className="text-sm text-neutral-600">
        Este questionário não está disponível agora.{' '}
        <Link to="/pesquisa/sessao" className="font-medium text-primary-600 hover:underline">
          Voltar para a pesquisa
        </Link>
        .
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-neutral-600">
        Para cada item, marque um ponto da escala de acordo com o que você sentiu durante as tarefas.
      </p>

      {RTLX_DIMENSOES.map((dimensao) => (
        <fieldset key={dimensao.chave} className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-neutral-900">
            {dimensao.titulo}: <span className="font-normal">{dimensao.pergunta}</span>
          </legend>
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-xs text-neutral-600">{dimensao.ancoraMinimo}</span>
            <div className="flex">
              {MARCAS.map((valor) => {
                const marcado = dimensoes[dimensao.chave] === valor
                return (
                  <label key={valor} className="flex cursor-pointer flex-col items-center px-0.5" title={String(valor)}>
                    <input
                      type="radio"
                      className="sr-only"
                      name={`rtlx-${dimensao.chave}`}
                      value={valor}
                      checked={marcado}
                      aria-label={`${dimensao.titulo}: ${String(valor)}`}
                      onChange={() => { setDimensoes((atual) => ({ ...atual, [dimensao.chave]: valor })) }}
                    />
                    <span
                      aria-hidden="true"
                      className={`block h-5 w-2.5 rounded-sm border ${
                        marcado ? 'border-primary-700 bg-primary-600' : 'border-neutral-300 bg-surface hover:bg-primary-100'
                      }`}
                    />
                  </label>
                )
              })}
            </div>
            <span className="shrink-0 text-xs text-neutral-600">{dimensao.ancoraMaximo}</span>
          </div>
          <span className="text-xs text-neutral-600">
            {dimensoes[dimensao.chave] === undefined ? 'Não respondido' : `Marcado: ${String(dimensoes[dimensao.chave])}`}
          </span>
        </fieldset>
      ))}

      {enviarMutation.isError ? (
        <p role="alert" className="text-sm text-danger-500">
          {enviarMutation.error.message}
        </p>
      ) : null}

      <Button isLoading={enviarMutation.isPending} disabled={!completo} onClick={handleSubmit}>
        Enviar
      </Button>
    </div>
  )
}

export default RtlxForm
