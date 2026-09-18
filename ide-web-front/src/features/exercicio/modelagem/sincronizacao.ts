import type { TabelaGerada } from './gerarSql'
import { normalizarIdentificador } from './identificadores'

/**
 * Sincronização bidirecional modelo ↔ consulta SQL (docs/decisions/fase6-alinhamento-tcc.md
 * e fase7-modelagem-conceitual-logica.md): o que está selecionado num lado é destacado no
 * outro. A seleção é sempre expressa em nomes normalizados — os mesmos do SQL gerado a
 * partir do modelo lógico.
 */
export interface Selecao {
  tabela: string | null
  coluna: string | null
}

export interface Intervalo {
  inicio: number
  fim: number
}

interface Identificador {
  qualificador: string | null
  nome: string
}

const CARACTERE_IDENTIFICADOR = /[\p{L}\p{N}_.]/u
const TOKEN_IDENTIFICADOR = /[\p{L}_][\p{L}\p{N}_]*(?:\.[\p{L}_][\p{L}\p{N}_]*)?/gu

const PALAVRAS_RESERVADAS = new Set([
  'select', 'from', 'where', 'join', 'inner', 'left', 'right', 'full', 'outer', 'cross', 'on', 'as', 'and', 'or',
  'not', 'group', 'order', 'by', 'having', 'limit', 'offset', 'union', 'all', 'distinct', 'insert', 'into',
  'values', 'update', 'set', 'delete', 'natural', 'using', 'in', 'is', 'null', 'like', 'between', 'case', 'when',
  'then', 'else', 'end', 'asc', 'desc', 'exists',
])

/**
 * Troca por espaços o conteúdo de strings ('...') e comentários (-- e /* *\/),
 * preservando o tamanho do texto — assim offsets continuam valendo e nomes
 * dentro de strings/comentários não são tratados como tabela/coluna.
 */
export function mascararStringsEComentarios(sql: string): string {
  return sql.replace(/'(?:[^']|'')*'?|--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/g, (trecho) => ' '.repeat(trecho.length))
}

export function identificadorNaPosicao(sql: string, offset: number): Identificador | null {
  const texto = mascararStringsEComentarios(sql)
  let inicio = offset
  let fim = offset
  while (inicio > 0 && CARACTERE_IDENTIFICADOR.test(texto.charAt(inicio - 1))) inicio -= 1
  while (fim < texto.length && CARACTERE_IDENTIFICADOR.test(texto.charAt(fim))) fim += 1

  const bruto = texto.slice(inicio, fim).replace(/^\.+|\.+$/g, '')
  if (!bruto || /^[\p{N}]/u.test(bruto)) return null

  const partes = bruto.split('.')
  const [primeira, segunda] = partes
  if (partes.length === 2 && primeira && segunda) {
    return { qualificador: normalizarIdentificador(primeira), nome: normalizarIdentificador(segunda) }
  }
  if (partes.length === 1 && primeira && !PALAVRAS_RESERVADAS.has(primeira.toLowerCase())) {
    return { qualificador: null, nome: normalizarIdentificador(primeira) }
  }
  return null
}

/** `FROM cliente c` / `JOIN pedido AS p` → { c: 'cliente', p: 'pedido' }. */
export function extrairAliases(sql: string): Map<string, string> {
  const aliases = new Map<string, string>()
  const texto = mascararStringsEComentarios(sql)
  // Alias em lookahead: senão o `JOIN` seguinte seria consumido como "alias" e a
  // próxima tabela (`JOIN pedido p`) nunca casaria.
  const padrao = /\b(?:from|join)\s+([\p{L}_][\p{L}\p{N}_]*)(?=(?:\s+(?:as\s+)?([\p{L}_][\p{L}\p{N}_]*))?)/giu
  for (const match of texto.matchAll(padrao)) {
    const tabela = match[1]
    const alias = match[2]
    if (tabela && alias && !PALAVRAS_RESERVADAS.has(alias.toLowerCase())) {
      aliases.set(normalizarIdentificador(alias), normalizarIdentificador(tabela))
    }
  }
  return aliases
}

const temColuna = (tabela: TabelaGerada, nome: string): boolean => tabela.colunas.some((coluna) => coluna.nome === nome)

/** Converte o identificador sob o cursor numa seleção que existe no modelo. */
export function resolverSelecao(
  identificador: Identificador,
  tabelas: TabelaGerada[],
  aliases: Map<string, string>,
): Selecao | null {
  const tabelaPorNome = (nome: string): TabelaGerada | undefined => tabelas.find((tabela) => tabela.nome === nome)

  if (identificador.qualificador) {
    const tabela = tabelaPorNome(aliases.get(identificador.qualificador) ?? identificador.qualificador)
    if (!tabela) return null
    return { tabela: tabela.nome, coluna: temColuna(tabela, identificador.nome) ? identificador.nome : null }
  }

  const tabelaDireta = tabelaPorNome(aliases.get(identificador.nome) ?? identificador.nome)
  if (tabelaDireta) return { tabela: tabelaDireta.nome, coluna: null }

  const donas = tabelas.filter((tabela) => temColuna(tabela, identificador.nome))
  const [unica] = donas
  if (donas.length === 1 && unica) return { tabela: unica.nome, coluna: identificador.nome }
  if (donas.length > 1) return { tabela: null, coluna: identificador.nome }
  return null
}

/** Trechos do SQL que correspondem à seleção feita no modelo. */
export function ocorrenciasNoSql(sql: string, selecao: Selecao, aliases: Map<string, string>): Intervalo[] {
  const texto = mascararStringsEComentarios(sql)
  const nomesDaTabela = new Set<string>()
  if (selecao.tabela) {
    nomesDaTabela.add(selecao.tabela)
    for (const [alias, tabela] of aliases) {
      if (tabela === selecao.tabela) nomesDaTabela.add(alias)
    }
  }

  const intervalos: Intervalo[] = []
  for (const match of texto.matchAll(TOKEN_IDENTIFICADOR)) {
    const token = match[0]
    const inicio = match.index
    const partes = token.split('.').map(normalizarIdentificador)
    const [primeira, segunda] = partes

    if (partes.length === 2 && primeira && segunda) {
      const qualificadorBate = nomesDaTabela.has(primeira)
      if (selecao.coluna) {
        if (segunda === selecao.coluna && (qualificadorBate || !selecao.tabela)) {
          const inicioColuna = inicio + token.indexOf('.') + 1
          intervalos.push({ inicio: inicioColuna, fim: inicio + token.length })
        }
      } else if (qualificadorBate) {
        intervalos.push({ inicio, fim: inicio + token.indexOf('.') })
      }
      continue
    }

    if (!primeira) continue
    if (selecao.coluna ? primeira === selecao.coluna : nomesDaTabela.has(primeira)) {
      intervalos.push({ inicio, fim: inicio + token.length })
    }
  }
  return intervalos
}
