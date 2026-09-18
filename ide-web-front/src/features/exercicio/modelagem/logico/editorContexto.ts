import { createContext, useContext } from 'react'
import type { Selecao } from '../sincronizacao'

export type SelecaoLogico =
  | { tipo: 'tabela'; id: string }
  | { tipo: 'coluna'; tabelaId: string; colunaId: string }
  | { tipo: 'ligacao'; id: string }
  | { tipo: 'nota'; id: string }

export interface LogicoEditorAcoes {
  somenteLeitura: boolean
  selecao: SelecaoLogico | null
  selecionar: (selecao: SelecaoLogico | null) => void
  renomearTabela: (tabelaId: string, nome: string) => void
  atualizarTextoNota: (notaId: string, texto: string) => void
  encerrarGesto: () => void
  // Sincronização com a consulta SQL: nomes normalizados vindos do editor SQL.
  destaque: Selecao | null
}

export const LogicoEditorContexto = createContext<LogicoEditorAcoes | null>(null)

export function useLogicoEditor(): LogicoEditorAcoes {
  const acoes = useContext(LogicoEditorContexto)
  if (!acoes) throw new Error('useLogicoEditor precisa estar dentro de <LogicoEditor>')
  return acoes
}
