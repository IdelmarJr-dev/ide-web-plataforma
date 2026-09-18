import { useCallback, useReducer } from 'react'

/**
 * Desfazer/refazer do editor de modelagem. Guarda estados inteiros (o modelo é
 * pequeno e imutável, então cópias compartilham estrutura). Mudanças consecutivas com
 * a mesma `chave` — arrastar um nó, digitar num campo — viram um passo só.
 */

export const LIMITE_HISTORICO = 100

export interface Historico<T> {
  passado: T[]
  presente: T
  futuro: T[]
  // Chave da última mudança aplicada; null depois de desfazer/refazer ou encerrar um gesto.
  ultimaChave: string | null
}

export type AcaoHistorico<T> =
  | { tipo: 'aplicar'; valor: T | ((atual: T) => T); chave: string | null }
  | { tipo: 'desfazer' }
  | { tipo: 'refazer' }
  | { tipo: 'encerrarGesto' }
  | { tipo: 'redefinir'; valor: T }

export function criarHistorico<T>(inicial: T): Historico<T> {
  return { passado: [], presente: inicial, futuro: [], ultimaChave: null }
}

export function reduzirHistorico<T>(estado: Historico<T>, acao: AcaoHistorico<T>): Historico<T> {
  switch (acao.tipo) {
    case 'aplicar': {
      const valor = typeof acao.valor === 'function' ? (acao.valor as (atual: T) => T)(estado.presente) : acao.valor
      if (valor === estado.presente) return estado
      if (acao.chave !== null && acao.chave === estado.ultimaChave) {
        return { ...estado, presente: valor, futuro: [] }
      }
      const passado = [...estado.passado, estado.presente].slice(-LIMITE_HISTORICO)
      return { passado, presente: valor, futuro: [], ultimaChave: acao.chave }
    }
    case 'desfazer': {
      const anterior = estado.passado.at(-1)
      if (anterior === undefined) return estado
      return {
        passado: estado.passado.slice(0, -1),
        presente: anterior,
        futuro: [estado.presente, ...estado.futuro],
        ultimaChave: null,
      }
    }
    case 'refazer': {
      const [proximo, ...restante] = estado.futuro
      if (proximo === undefined) return estado
      return { passado: [...estado.passado, estado.presente], presente: proximo, futuro: restante, ultimaChave: null }
    }
    case 'encerrarGesto':
      return estado.ultimaChave === null ? estado : { ...estado, ultimaChave: null }
    case 'redefinir':
      return criarHistorico(acao.valor)
  }
}

export interface UsoHistorico<T> {
  valor: T
  // Aceita função (estado atual → novo), pra eventos em sequência não usarem estado velho.
  aplicar: (valor: T | ((atual: T) => T), chave?: string) => void
  desfazer: () => void
  refazer: () => void
  encerrarGesto: () => void
  podeDesfazer: boolean
  podeRefazer: boolean
}

export function useHistorico<T>(inicial: T): UsoHistorico<T> {
  const [estado, despachar] = useReducer(reduzirHistorico<T>, inicial, criarHistorico)

  const aplicar = useCallback((valor: T | ((atual: T) => T), chave?: string) => {
    despachar({ tipo: 'aplicar', valor, chave: chave ?? null })
  }, [])
  const desfazer = useCallback(() => { despachar({ tipo: 'desfazer' }) }, [])
  const refazer = useCallback(() => { despachar({ tipo: 'refazer' }) }, [])
  const encerrarGesto = useCallback(() => { despachar({ tipo: 'encerrarGesto' }) }, [])

  return {
    valor: estado.presente,
    aplicar,
    desfazer,
    refazer,
    encerrarGesto,
    podeDesfazer: estado.passado.length > 0,
    podeRefazer: estado.futuro.length > 0,
  }
}
