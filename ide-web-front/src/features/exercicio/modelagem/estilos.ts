/**
 * Identidade visual dos dois editores de modelagem: o conceitual e o lógico são a mesma
 * ferramenta em níveis diferentes, então formas, contornos, alças e linhas saem daqui em
 * vez de serem escritos nó a nó (docs/decisions/fase7-modelagem-conceitual-logica.md).
 */

export const COR_TRACO = 'var(--color-neutral-700)'
/** Linhas auxiliares (atributo → dono, especialização → filha). */
export const COR_TRACO_LEVE = 'var(--color-neutral-500)'
export const COR_SELECAO = 'var(--color-primary-600)'

export const ESPESSURA_LINHA = { normal: 1.5, leve: 1.25, selecionada: 2.5 } as const

/** Alça de ligação: mesma no losango, na entidade e na tabela. */
export const CLASSE_ALCA = 'h-3! w-3! border-2! border-white! bg-primary-500!'

/** Em leitura (gabarito, revisão do professor) as alças somem: não há o que ligar. */
export function classeAlca(somenteLeitura: boolean): string {
  return somenteLeitura ? 'pointer-events-none! opacity-0!' : CLASSE_ALCA
}

/** Fundo, texto e sombra de qualquer nó com caixa (entidade, tabela, associativa). */
export const CLASSE_CAIXA = 'rounded-sm bg-surface text-xs shadow-sm'

/** Contorno do nó conforme o estado. `destacada` é a sincronização com a consulta SQL. */
export function classeContorno(selecionado: boolean, destacada = false): string {
  if (selecionado) return 'border-2 border-primary-600 ring-2 ring-primary-100'
  if (destacada) return 'border-2 border-primary-500 ring-2 ring-primary-100'
  return 'border-2 border-neutral-700'
}

/** Rótulo sobre a linha: `(mín,máx)` no conceitual, cardinalidade calculada no lógico. */
export const CLASSE_ROTULO_LINHA = 'pointer-events-none absolute rounded bg-surface/90 px-0.5 text-[10px] text-neutral-700'

export function estiloLinha(selecionada: boolean, leve = false): { stroke: string; strokeWidth: number } {
  if (selecionada) return { stroke: COR_SELECAO, strokeWidth: ESPESSURA_LINHA.selecionada }
  return leve
    ? { stroke: COR_TRACO_LEVE, strokeWidth: ESPESSURA_LINHA.leve }
    : { stroke: COR_TRACO, strokeWidth: ESPESSURA_LINHA.normal }
}

/** Contorno das formas desenhadas em SVG (losango do relacionamento, triângulo da especialização). */
export function tracoDaForma(selecionada: boolean): { stroke: string; strokeWidth: number } {
  return { stroke: selecionada ? COR_SELECAO : COR_TRACO, strokeWidth: selecionada ? 2.5 : 2 }
}
