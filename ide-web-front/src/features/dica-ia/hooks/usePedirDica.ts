import { useCallback, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { HttpError } from '../../../lib/httpClient'
import { dicaIaService } from '../services/dicaIaService'
import type { ContextoDica, DicaIa, EstadoDica } from '../types'

const HTTP_CONFLICT = 409

interface UsePedirDicaResult {
  pedir: (estado: EstadoDica) => void
  isPending: boolean
  dica: DicaIa | null
  fecharDica: () => void
  quotaAtingida: boolean
  erro: HttpError | null
}

/**
 * Pedido de dica de IA para uma parte (SQL ou MER) de um exercício — ver
 * docs/decisions/fase3-dicas-ia.md. Uma vez atingido o limite (409), o botão que
 * usa este hook deve ficar desabilitado sem precisar de um novo clique pra saber disso.
 */
export function usePedirDica(exercicioId: string, contexto: ContextoDica): UsePedirDicaResult {
  const [dica, setDica] = useState<DicaIa | null>(null)
  const [quotaAtingida, setQuotaAtingida] = useState(false)

  const mutation = useMutation({
    mutationFn: (estado: EstadoDica) => dicaIaService.pedir(exercicioId, { contexto, ...estado }),
    onSuccess: (novaDica) => {
      setDica(novaDica)
    },
    onError: (erro: unknown) => {
      if (erro instanceof HttpError && erro.status === HTTP_CONFLICT) {
        setQuotaAtingida(true)
      }
    },
  })

  const fecharDica = useCallback(() => {
    setDica(null)
  }, [])

  return {
    pedir: mutation.mutate,
    isPending: mutation.isPending,
    dica,
    fecharDica,
    quotaAtingida,
    erro: mutation.error instanceof HttpError ? mutation.error : null,
  }
}
