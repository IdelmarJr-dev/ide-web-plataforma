import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '~components/Button/Button'
import { MINHA_PARTICIPACAO_QUERY_KEY, useMinhaParticipacao } from '../hooks/useMinhaParticipacao'
import { pesquisaService } from '../services/pesquisaService'
import { SUS_ANCORAS, SUS_ITENS, calcularPontuacaoSus } from '../utils/susScore'

const ESCALA = [1, 2, 3, 4, 5]

export const SusForm = (): ReactNode => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: participacao, isLoading } = useMinhaParticipacao()
  const [respostas, setRespostas] = useState<Record<number, number>>({})
  const sessao = participacao?.sessao

  const enviarMutation = useMutation({
    mutationFn: () => {
      if (!sessao) throw new Error('Sessão não encontrada')
      const valores = SUS_ITENS.map((_, indice) => respostas[indice] ?? 0)
      const itens = Object.fromEntries(valores.map((valor, indice) => [String(indice + 1), valor]))
      return pesquisaService.enviarSus(sessao.id, itens, calcularPontuacaoSus(valores))
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MINHA_PARTICIPACAO_QUERY_KEY })
      void navigate('/pesquisa/rtlx')
    },
  })

  const completo = SUS_ITENS.every((_, indice) => respostas[indice] !== undefined)

  const handleSubmit = useCallback(() => {
    if (!completo) return
    enviarMutation.mutate()
  }, [completo, enviarMutation])

  if (isLoading) {
    return <p className="text-sm text-neutral-600">Carregando…</p>
  }

  if (!sessao?.finalizadaEm || participacao?.susRespondido) {
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
        Pensando no ambiente que você acabou de usar nas tarefas, marque de 1 ({SUS_ANCORAS.minimo.toLowerCase()}) a 5 (
        {SUS_ANCORAS.maximo.toLowerCase()}) para cada afirmação.
      </p>

      {SUS_ITENS.map((item, indice) => (
        <fieldset key={item} className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-neutral-900">
            {indice + 1}. {item}
          </legend>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs text-neutral-600">{SUS_ANCORAS.minimo}</span>
            {ESCALA.map((valor) => (
              <label key={valor} className="flex items-center gap-1 text-sm text-neutral-600">
                <input
                  type="radio"
                  name={`sus-${String(indice)}`}
                  value={valor}
                  checked={respostas[indice] === valor}
                  onChange={() => { setRespostas((atual) => ({ ...atual, [indice]: valor })) }}
                />
                {valor}
              </label>
            ))}
            <span className="text-xs text-neutral-600">{SUS_ANCORAS.maximo}</span>
          </div>
        </fieldset>
      ))}

      {enviarMutation.isError ? (
        <p role="alert" className="text-sm text-danger-500">
          {enviarMutation.error.message}
        </p>
      ) : null}

      <Button isLoading={enviarMutation.isPending} disabled={!completo} onClick={handleSubmit}>
        Continuar
      </Button>
    </div>
  )
}

export default SusForm
