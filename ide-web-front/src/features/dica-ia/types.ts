export const CONTEXTOS_DICA = ['sql', 'mer'] as const
export type ContextoDica = (typeof CONTEXTOS_DICA)[number]

export interface DicaIa {
  id: string
  contexto: ContextoDica
  respostaIa: string
  criadoEm: string
}

// Estado ao vivo dos editores. Desde a Fase 6 vão os dois juntos (quando o exercício
// tem as duas partes) pra IA apontar incoerência entre o MER e a consulta.
export interface EstadoDica {
  estadoMer?: unknown
  estadoSql?: string
}

export interface PedirDicaInput extends EstadoDica {
  contexto: ContextoDica
}

// Estudo livre (Fase 8): sem exercício/gabarito por trás, por isso sem `id`/`contexto`
// persistidos — ver DicaLivreService no backend.
export interface PedirDicaLivreInput {
  sql: string
  objetivo?: string
}

export interface DicaLivre {
  respostaIa: string
}
