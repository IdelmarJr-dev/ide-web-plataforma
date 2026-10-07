import { useCallback, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { HttpError } from '../../../lib/httpClient'
import { dicaIaService } from '../services/dicaIaService'
import type { PedirDicaLivreInput } from '../types'

interface UsePedirDicaLivreResult {
  pedir: (input: PedirDicaLivreInput) => void
  isPending: boolean
  respostaIa: string | null
  fecharDica: () => void
  erro: HttpError | null
}

/**
 * Pedido de dica de IA no estudo livre (banco sem exercício) — ver DicaLivreService no
 * backend. Sem quota por conteúdo como no `usePedirDica`: o limite aqui é só de taxa,
 * reportado como 429 pelo backend.
 */
export function usePedirDicaLivre(): UsePedirDicaLivreResult {
  const [respostaIa, setRespostaIa] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (input: PedirDicaLivreInput) => dicaIaService.pedirLivre(input),
    onSuccess: (dica) => {
      setRespostaIa(dica.respostaIa)
    },
  })

  const fecharDica = useCallback(() => {
    setRespostaIa(null)
  }, [])

  return {
    pedir: mutation.mutate,
    isPending: mutation.isPending,
    respostaIa,
    fecharDica,
    erro: mutation.error instanceof HttpError ? mutation.error : null,
  }
}
