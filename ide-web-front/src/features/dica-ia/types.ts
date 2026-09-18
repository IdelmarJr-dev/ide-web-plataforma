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
