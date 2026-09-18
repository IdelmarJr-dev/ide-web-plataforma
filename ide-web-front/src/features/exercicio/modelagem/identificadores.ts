/**
 * Nomes de tabela/coluna como o PostgreSQL enxerga: minúsculas, sem acento, `_`
 * no lugar de espaço/símbolo. Espelho de `ide-web-backend/src/utils/modelagem/identificadores.ts`.
 */

const MARCAS_DIACRITICAS = /[̀-ͯ]/g

export function normalizarIdentificador(nome: string): string {
  const semAcento = nome.normalize('NFD').replace(MARCAS_DIACRITICAS, '')
  const identificador = semAcento
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return /^[0-9]/.test(identificador) ? `_${identificador}` : identificador
}

// Palavras reservadas do PostgreSQL (reservadas e "requer AS"): como nome de tabela
// ou coluna precisam de aspas.
const RESERVADAS_POSTGRES = new Set([
  'all', 'analyse', 'analyze', 'and', 'any', 'array', 'as', 'asc', 'asymmetric', 'authorization', 'binary', 'both',
  'case', 'cast', 'check', 'collate', 'collation', 'column', 'concurrently', 'constraint', 'create', 'cross',
  'current_catalog', 'current_date', 'current_role', 'current_schema', 'current_time', 'current_timestamp',
  'current_user', 'default', 'deferrable', 'desc', 'distinct', 'do', 'else', 'end', 'except', 'false', 'fetch',
  'for', 'foreign', 'freeze', 'from', 'full', 'grant', 'group', 'having', 'ilike', 'in', 'initially', 'inner',
  'intersect', 'into', 'is', 'isnull', 'join', 'lateral', 'leading', 'left', 'like', 'limit', 'localtime',
  'localtimestamp', 'natural', 'not', 'notnull', 'null', 'offset', 'on', 'only', 'or', 'order', 'outer',
  'overlaps', 'placing', 'primary', 'references', 'returning', 'right', 'select', 'session_user', 'similar',
  'some', 'symmetric', 'system_user', 'table', 'tablesample', 'then', 'to', 'trailing', 'true', 'union', 'unique',
  'user', 'using', 'variadic', 'verbose', 'when', 'where', 'window', 'with',
])

export function ehPalavraReservada(identificador: string): boolean {
  return RESERVADAS_POSTGRES.has(identificador)
}

/** Identificador pronto pra entrar no SQL: entre aspas se for palavra reservada. */
export function identificadorSql(identificador: string): string {
  return ehPalavraReservada(identificador) ? `"${identificador}"` : identificador
}
