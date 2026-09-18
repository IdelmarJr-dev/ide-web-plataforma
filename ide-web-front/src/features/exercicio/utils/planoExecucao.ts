/**
 * Converte o JSON do EXPLAIN (FORMAT JSON) do PostgreSQL numa árvore simples,
 * usada por `components/PlanoExecucao.tsx`.
 */

export interface NoPlano {
  tipo: string
  tabela: string | null
  alias: string | null
  indice: string | null
  linhasEstimadas: number | null
  custoTotal: number | null
  filhos: NoPlano[]
}

export const TRADUCOES: Record<string, string> = {
  'Seq Scan': 'Leitura sequencial (percorre a tabela inteira)',
  'Index Scan': 'Busca usando índice',
  'Index Only Scan': 'Busca só no índice, sem ler a tabela',
  'Bitmap Heap Scan': 'Leitura da tabela guiada por índice',
  'Bitmap Index Scan': 'Varredura de índice',
  'Hash Join': 'Junção por hash',
  'Nested Loop': 'Junção por laço aninhado',
  'Merge Join': 'Junção por intercalação',
  Hash: 'Monta tabela hash para a junção',
  Sort: 'Ordenação',
  Aggregate: 'Agregação (COUNT, SUM, AVG…)',
  HashAggregate: 'Agregação por hash (GROUP BY)',
  GroupAggregate: 'Agregação por grupos (GROUP BY)',
  Limit: 'Limite de linhas',
  Result: 'Resultado calculado',
  Materialize: 'Guarda resultado intermediário',
  Unique: 'Remove linhas duplicadas',
  Append: 'Junta resultados (UNION)',
  'Subquery Scan': 'Leitura de subconsulta',
  'CTE Scan': 'Leitura de CTE (WITH)',
  ModifyTable: 'Modifica a tabela (INSERT/UPDATE/DELETE)',
}

function isRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function textoOuNull(valor: unknown): string | null {
  return typeof valor === 'string' ? valor : null
}

function numeroOuNull(valor: unknown): number | null {
  return typeof valor === 'number' ? valor : null
}

function converterNo(bruto: Record<string, unknown>): NoPlano | null {
  const tipo = textoOuNull(bruto['Node Type'])
  if (!tipo) return null
  const filhosBrutos = Array.isArray(bruto.Plans) ? bruto.Plans : []
  return {
    tipo,
    tabela: textoOuNull(bruto['Relation Name']),
    alias: textoOuNull(bruto.Alias),
    indice: textoOuNull(bruto['Index Name']),
    linhasEstimadas: numeroOuNull(bruto['Plan Rows']),
    custoTotal: numeroOuNull(bruto['Total Cost']),
    filhos: filhosBrutos.filter(isRegistro).map(converterNo).filter((no): no is NoPlano => no !== null),
  }
}

/** Formato do Postgres: `[{ "Plan": { "Node Type": ..., "Plans": [...] } }]`. */
export function extrairPlano(plano: unknown): NoPlano | null {
  const primeiro: unknown = Array.isArray(plano) ? plano[0] : plano
  if (!isRegistro(primeiro) || !isRegistro(primeiro.Plan)) return null
  return converterNo(primeiro.Plan)
}
