import { createContext, use } from 'react'

export type Tema = 'claro' | 'escuro'

export interface TemaContextValue {
  tema: Tema
  alternarTema: () => void
}

export const TemaContext = createContext<TemaContextValue | null>(null)

export function useTema(): TemaContextValue {
  const ctx = use(TemaContext)
  if (!ctx) {
    throw new Error('useTema must be used within a TemaProvider')
  }
  return ctx
}
