import type { Coluna, ModeloLogico, Nota, Tabela } from '../documento'
import { gerarId, TIPOS_COM_TAMANHO, TIPOS_INTEIROS } from '../documento'
import { normalizarIdentificador } from '../identificadores'

/**
 * Operações puras sobre o modelo lógico. O editor só chama estas funções; tudo que
 * é regra (FK criada ao ligar tabelas, cascata ao remover, invariantes de coluna)
 * mora aqui e é testado sem React Flow.
 */

export interface Posicao {
  x: number
  y: number
}

export type CardinalidadeFk = '(0,1)' | '(1,1)' | '(0,n)'

export interface LigacaoFk {
  id: string
  // Tabela referenciada (lado da PK) → tabela com as colunas FK.
  tabelaReferenciadaId: string
  tabelaId: string
  colunaIds: string[]
  // Heuser: junto da tabela referenciada = quantas linhas dela uma linha da outra referencia.
  cardinalidadeReferenciada: CardinalidadeFk
  cardinalidadeReferenciadora: CardinalidadeFk
}

export type ResultadoOperacao = { ok: true; logico: ModeloLogico } | { ok: false; erro: string }

const DESLOCAMENTO_COPIA = 40

function nomeUnico(base: string, existentes: Iterable<string>): string {
  const usados = new Set([...existentes].map(normalizarIdentificador))
  if (!usados.has(normalizarIdentificador(base))) return base
  let sufixo = 2
  while (usados.has(normalizarIdentificador(`${base}_${String(sufixo)}`))) sufixo += 1
  return `${base}_${String(sufixo)}`
}

function mapearTabela(logico: ModeloLogico, tabelaId: string, mudar: (tabela: Tabela) => Tabela): ModeloLogico {
  return { ...logico, tabelas: logico.tabelas.map((tabela) => (tabela.id === tabelaId ? mudar(tabela) : tabela)) }
}

export function colunaPadrao(nome: string, mudancas: Partial<Coluna> = {}): Coluna {
  return {
    id: gerarId('coluna'),
    nome,
    tipo: 'VARCHAR',
    tamanho: null,
    escala: null,
    pk: false,
    notNull: false,
    unique: false,
    autoIncremento: false,
    padrao: '',
    check: '',
    fk: null,
    ...mudancas,
  }
}

export function adicionarTabela(logico: ModeloLogico, posicao: Posicao): { logico: ModeloLogico; tabelaId: string } {
  const nome = nomeUnico(`tabela${String(logico.tabelas.length + 1)}`, logico.tabelas.map((tabela) => tabela.nome))
  const tabela: Tabela = {
    id: gerarId('tabela'),
    posicao,
    nome,
    colunas: [colunaPadrao('id', { tipo: 'INTEGER', pk: true, notNull: true })],
  }
  return { logico: { ...logico, tabelas: [...logico.tabelas, tabela] }, tabelaId: tabela.id }
}

export function renomearTabela(logico: ModeloLogico, tabelaId: string, nome: string): ModeloLogico {
  return mapearTabela(logico, tabelaId, (tabela) => ({ ...tabela, nome }))
}

export function moverTabela(logico: ModeloLogico, tabelaId: string, posicao: Posicao): ModeloLogico {
  return mapearTabela(logico, tabelaId, (tabela) => ({ ...tabela, posicao }))
}

export function adicionarColuna(logico: ModeloLogico, tabelaId: string): { logico: ModeloLogico; colunaId: string } {
  const tabela = logico.tabelas.find((existente) => existente.id === tabelaId)
  const coluna = colunaPadrao(
    nomeUnico(`coluna${String((tabela?.colunas.length ?? 0) + 1)}`, tabela?.colunas.map((c) => c.nome) ?? []),
  )
  return {
    logico: mapearTabela(logico, tabelaId, (atual) => ({ ...atual, colunas: [...atual.colunas, coluna] })),
    colunaId: coluna.id,
  }
}

/** Mantém as regras de coluna coerentes depois de uma mudança feita no painel. */
export function normalizarColuna(coluna: Coluna): Coluna {
  const ehInteiro = TIPOS_INTEIROS.includes(coluna.tipo)
  const temTamanho = TIPOS_COM_TAMANHO.includes(coluna.tipo)
  return {
    ...coluna,
    tamanho: temTamanho ? coluna.tamanho : null,
    escala: coluna.tipo === 'NUMERIC' ? coluna.escala : null,
    autoIncremento: ehInteiro && coluna.autoIncremento,
    notNull: coluna.notNull || coluna.pk || (ehInteiro && coluna.autoIncremento),
  }
}

/**
 * Atualiza uma coluna. Se o tipo de uma coluna referenciada muda, as colunas FK que
 * apontam pra ela acompanham — FK e origem nunca ficam com tipos diferentes por acidente.
 */
export function atualizarColuna(
  logico: ModeloLogico,
  tabelaId: string,
  colunaId: string,
  mudancas: Partial<Omit<Coluna, 'id'>>,
): ModeloLogico {
  const tabela = logico.tabelas.find((existente) => existente.id === tabelaId)
  const atual = tabela?.colunas.find((coluna) => coluna.id === colunaId)
  if (!tabela || !atual) return logico

  const nova = normalizarColuna({ ...atual, ...mudancas })
  const tipoMudou = nova.tipo !== atual.tipo || nova.tamanho !== atual.tamanho || nova.escala !== atual.escala

  return {
    ...logico,
    tabelas: logico.tabelas.map((existente) => ({
      ...existente,
      colunas: existente.colunas.map((coluna) => {
        if (existente.id === tabelaId && coluna.id === colunaId) return nova
        if (tipoMudou && coluna.fk?.tabelaId === tabelaId && coluna.fk.colunaId === colunaId) {
          return normalizarColuna({ ...coluna, tipo: nova.tipo, tamanho: nova.tamanho, escala: nova.escala })
        }
        return coluna
      }),
    })),
  }
}

function limparFksPara(logico: ModeloLogico, alvo: (fk: NonNullable<Coluna['fk']>) => boolean): ModeloLogico {
  return {
    ...logico,
    tabelas: logico.tabelas.map((tabela) => ({
      ...tabela,
      colunas: tabela.colunas.map((coluna) => (coluna.fk && alvo(coluna.fk) ? { ...coluna, fk: null } : coluna)),
    })),
  }
}

/** Remove a coluna; colunas FK que apontavam pra ela deixam de ser FK (continuam existindo). */
export function removerColuna(logico: ModeloLogico, tabelaId: string, colunaId: string): ModeloLogico {
  const semColuna = mapearTabela(logico, tabelaId, (tabela) => ({
    ...tabela,
    colunas: tabela.colunas.filter((coluna) => coluna.id !== colunaId),
  }))
  return limparFksPara(semColuna, (fk) => fk.tabelaId === tabelaId && fk.colunaId === colunaId)
}

export function removerTabela(logico: ModeloLogico, tabelaId: string): ModeloLogico {
  const semTabela = { ...logico, tabelas: logico.tabelas.filter((tabela) => tabela.id !== tabelaId) }
  return limparFksPara(semTabela, (fk) => fk.tabelaId === tabelaId)
}

export function moverColuna(logico: ModeloLogico, tabelaId: string, colunaId: string, deslocamento: -1 | 1): ModeloLogico {
  return mapearTabela(logico, tabelaId, (tabela) => {
    const indice = tabela.colunas.findIndex((coluna) => coluna.id === colunaId)
    const destino = indice + deslocamento
    if (indice < 0 || destino < 0 || destino >= tabela.colunas.length) return tabela
    const colunas = [...tabela.colunas]
    const [coluna] = colunas.splice(indice, 1)
    if (coluna) colunas.splice(destino, 0, coluna)
    return { ...tabela, colunas }
  })
}

/**
 * Ligar A → B: cria em B uma coluna FK pra cada parte da PK de A, com nome e tipo
 * reais da PK (`<a>_<pk>`). Auto-relacionamento cria a FK opcional (a raiz não tem pai).
 */
export function ligarTabelas(logico: ModeloLogico, referenciadaId: string, tabelaId: string): ResultadoOperacao {
  const referenciada = logico.tabelas.find((tabela) => tabela.id === referenciadaId)
  const tabela = logico.tabelas.find((existente) => existente.id === tabelaId)
  if (!referenciada || !tabela) return { ok: false, erro: 'Tabela não encontrada.' }

  const pks = referenciada.colunas.filter((coluna) => coluna.pk)
  const nomeReferenciada = normalizarIdentificador(referenciada.nome) || 'tabela'
  if (pks.length === 0) {
    return { ok: false, erro: `Defina a chave primária de "${nomeReferenciada}" antes de ligar as tabelas.` }
  }

  const autoRelacionamento = referenciadaId === tabelaId
  const nomesUsados = tabela.colunas.map((coluna) => coluna.nome)
  const novas = pks.map((pk) => {
    const nome = nomeUnico(`${nomeReferenciada}_${normalizarIdentificador(pk.nome) || 'id'}`, nomesUsados)
    nomesUsados.push(nome)
    return colunaPadrao(nome, {
      tipo: pk.tipo,
      tamanho: pk.tamanho,
      escala: pk.escala,
      notNull: !autoRelacionamento,
      fk: { tabelaId: referenciadaId, colunaId: pk.id },
    })
  })

  return {
    ok: true,
    logico: mapearTabela(logico, tabelaId, (atual) => ({ ...atual, colunas: [...atual.colunas, ...novas] })),
  }
}

/** Agrupa as colunas FK de uma tabela em ligações (mesma regra de agrupamento do gerarSql). */
function gruposFk(tabela: Tabela): { referenciadaId: string; colunas: Coluna[]; referenciadasIds: string[] }[] {
  const grupos: { referenciadaId: string; colunas: Coluna[]; referenciadasIds: string[] }[] = []
  for (const coluna of tabela.colunas) {
    const { fk } = coluna
    if (!fk) continue
    const grupo = grupos.find((g) => g.referenciadaId === fk.tabelaId && !g.referenciadasIds.includes(fk.colunaId))
    if (grupo) {
      grupo.colunas.push(coluna)
      grupo.referenciadasIds.push(fk.colunaId)
    } else {
      grupos.push({ referenciadaId: fk.tabelaId, colunas: [coluna], referenciadasIds: [fk.colunaId] })
    }
  }
  return grupos
}

export function ligacoesFk(logico: ModeloLogico): LigacaoFk[] {
  const existentes = new Set(logico.tabelas.map((tabela) => tabela.id))
  return logico.tabelas.flatMap((tabela) =>
    gruposFk(tabela)
      .filter((grupo) => existentes.has(grupo.referenciadaId))
      .map((grupo) => {
        const colunaIds = grupo.colunas.map((coluna) => coluna.id)
        const pksDaTabela = tabela.colunas.filter((coluna) => coluna.pk).map((coluna) => coluna.id)
        const ehPkInteira = pksDaTabela.length === colunaIds.length && grupo.colunas.every((coluna) => coluna.pk)
        const ehUnica = ehPkInteira || (grupo.colunas.length === 1 && grupo.colunas[0]?.unique === true)
        return {
          id: `fk:${tabela.id}:${colunaIds.join(',')}`,
          tabelaReferenciadaId: grupo.referenciadaId,
          tabelaId: tabela.id,
          colunaIds,
          cardinalidadeReferenciada: grupo.colunas.every((coluna) => coluna.notNull) ? '(1,1)' : '(0,1)',
          cardinalidadeReferenciadora: ehUnica ? '(0,1)' : '(0,n)',
        } satisfies LigacaoFk
      }),
  )
}

/** Desfaz uma ligação: remove as colunas FK que ela criou. */
export function removerLigacao(logico: ModeloLogico, ligacao: Pick<LigacaoFk, 'tabelaId' | 'colunaIds'>): ModeloLogico {
  return mapearTabela(logico, ligacao.tabelaId, (tabela) => ({
    ...tabela,
    colunas: tabela.colunas.filter((coluna) => !ligacao.colunaIds.includes(coluna.id)),
  }))
}

export function duplicarTabela(logico: ModeloLogico, tabelaId: string): { logico: ModeloLogico; tabelaId: string } | null {
  const original = logico.tabelas.find((tabela) => tabela.id === tabelaId)
  if (!original) return null

  const novosIds = new Map(original.colunas.map((coluna) => [coluna.id, gerarId('coluna')]))
  const copiaId = gerarId('tabela')
  const copia: Tabela = {
    id: copiaId,
    posicao: { x: original.posicao.x + DESLOCAMENTO_COPIA, y: original.posicao.y + DESLOCAMENTO_COPIA },
    nome: nomeUnico(`${original.nome || 'tabela'}_copia`, logico.tabelas.map((tabela) => tabela.nome)),
    colunas: original.colunas.map((coluna) => ({
      ...coluna,
      id: novosIds.get(coluna.id) ?? gerarId('coluna'),
      // Auto-referência passa a apontar pra própria cópia.
      fk:
        coluna.fk?.tabelaId === tabelaId
          ? { tabelaId: copiaId, colunaId: novosIds.get(coluna.fk.colunaId) ?? coluna.fk.colunaId }
          : coluna.fk,
    })),
  }
  return { logico: { ...logico, tabelas: [...logico.tabelas, copia] }, tabelaId: copiaId }
}

export function adicionarNota(logico: ModeloLogico, posicao: Posicao): { logico: ModeloLogico; notaId: string } {
  const nota: Nota = { id: gerarId('nota'), posicao, texto: '' }
  return { logico: { ...logico, notas: [...logico.notas, nota] }, notaId: nota.id }
}

export function atualizarNota(logico: ModeloLogico, notaId: string, mudancas: Partial<Omit<Nota, 'id'>>): ModeloLogico {
  return { ...logico, notas: logico.notas.map((nota) => (nota.id === notaId ? { ...nota, ...mudancas } : nota)) }
}

export function removerNota(logico: ModeloLogico, notaId: string): ModeloLogico {
  return { ...logico, notas: logico.notas.filter((nota) => nota.id !== notaId) }
}
