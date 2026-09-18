import { createContext, useContext } from 'react'

export type SelecaoConceitual =
  | { tipo: 'entidade' | 'relacionamento' | 'atributo' | 'especializacao' | 'nota'; id: string }
  // Ligações: participação (relacionamento↔entidade) e filho de especialização.
  | { tipo: 'participacao' | 'filho'; id: string }

export interface ConceitualEditorAcoes {
  somenteLeitura: boolean
  selecao: SelecaoConceitual | null
  selecionar: (selecao: SelecaoConceitual | null) => void
  renomearElemento: (id: string, nome: string) => void
  atualizarTextoNota: (id: string, texto: string) => void
  encerrarGesto: () => void
}

export const ConceitualEditorContexto = createContext<ConceitualEditorAcoes | null>(null)

export function useConceitualEditor(): ConceitualEditorAcoes {
  const acoes = useContext(ConceitualEditorContexto)
  if (!acoes) throw new Error('useConceitualEditor precisa estar dentro de <ConceitualEditor>')
  return acoes
}
