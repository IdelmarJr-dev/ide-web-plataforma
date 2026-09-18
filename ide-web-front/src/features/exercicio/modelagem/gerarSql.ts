import type { Coluna, ModeloLogico, Tabela } from './documento'
import { TIPOS_INTEIROS } from './documento'
import { ehPalavraReservada, identificadorSql, normalizarIdentificador } from './identificadores'

/**
 * SQL de definição (PostgreSQL) do modelo lógico. Função pura, espelhada em
 * `ide-web-backend/src/utils/modelagem/gerarSql.ts` — mantenha as duas iguais e com
 * os mesmos casos de teste. Só é exibido (e mandado à IA); nunca é executado.
 * Ver docs/decisions/fase7-modelagem-conceitual-logica.md.
 */

export interface ColunaGerada {
  id: string
  nome: string
}

export interface TabelaGerada {
  id: string
  nome: string
  colunas: ColunaGerada[]
  // Linhas (1-based) do bloco CREATE TABLE no SQL — usadas pro destaque da sincronização.
  linhaInicio: number
  linhaFim: number
}

export interface SqlGerado {
  sql: string
  avisos: string[]
  tabelas: TabelaGerada[]
}

interface ColunaPreparada {
  coluna: Coluna
  nome: string
}

interface TabelaPreparada {
  tabela: Tabela
  nome: string
  colunas: ColunaPreparada[]
}

interface GrupoFk {
  colunas: ColunaPreparada[]
  tabelaReferenciadaId: string
  colunasReferenciadasIds: string[]
}

const TAMANHO_PADRAO_VARCHAR = 255
const LIMITE_IDENTIFICADOR_POSTGRES = 63

export function renderizarTipo(coluna: Pick<Coluna, 'tipo' | 'tamanho' | 'escala'>): string {
  switch (coluna.tipo) {
    case 'VARCHAR':
      return `VARCHAR(${String(coluna.tamanho ?? TAMANHO_PADRAO_VARCHAR)})`
    case 'CHAR':
      return `CHAR(${String(coluna.tamanho ?? 1)})`
    case 'NUMERIC':
      if (coluna.tamanho === null) return 'NUMERIC(10, 2)'
      return coluna.escala === null
        ? `NUMERIC(${String(coluna.tamanho)})`
        : `NUMERIC(${String(coluna.tamanho)}, ${String(coluna.escala)})`
    default:
      return coluna.tipo
  }
}

function parentesesBalanceados(expressao: string): boolean {
  let abertos = 0
  for (const caractere of expressao) {
    if (caractere === '(') abertos += 1
    if (caractere === ')') abertos -= 1
    if (abertos < 0) return false
  }
  return abertos === 0
}

function prepararTabelas(logico: ModeloLogico, avisos: string[]): TabelaPreparada[] {
  const nomesTabelas = new Set<string>()
  const reservadasAvisadas = new Set<string>()
  const avisarReservada = (nome: string): void => {
    if (ehPalavraReservada(nome) && !reservadasAvisadas.has(nome)) {
      reservadasAvisadas.add(nome)
      avisos.push(`"${nome}" é palavra reservada do PostgreSQL; foi escrita entre aspas.`)
    }
  }

  return logico.tabelas.map((tabela, indice) => {
    let nome = normalizarIdentificador(tabela.nome)
    if (!nome) {
      avisos.push('Uma tabela está sem nome.')
      nome = `tabela_sem_nome_${String(indice + 1)}`
    }
    if (nomesTabelas.has(nome)) avisos.push(`Existem duas tabelas com o nome "${nome}".`)
    nomesTabelas.add(nome)
    avisarReservada(nome)

    const nomesColunas = new Set<string>()
    const colunas: ColunaPreparada[] = []
    for (const coluna of tabela.colunas) {
      const nomeColuna = normalizarIdentificador(coluna.nome)
      if (!nomeColuna) {
        avisos.push(`A tabela "${nome}" tem uma coluna sem nome.`)
        continue
      }
      if (nomesColunas.has(nomeColuna)) avisos.push(`A tabela "${nome}" tem duas colunas "${nomeColuna}".`)
      nomesColunas.add(nomeColuna)
      avisarReservada(nomeColuna)
      colunas.push({ coluna, nome: nomeColuna })
    }

    if (colunas.length === 0) avisos.push(`A tabela "${nome}" não tem colunas.`)
    else if (!colunas.some(({ coluna }) => coluna.pk)) avisos.push(`A tabela "${nome}" não tem chave primária.`)
    return { tabela, nome, colunas }
  })
}

function validarColunas(tabela: TabelaPreparada, avisos: string[]): void {
  for (const { coluna, nome } of tabela.colunas) {
    const rotulo = `${tabela.nome}.${nome}`
    if (coluna.autoIncremento && !TIPOS_INTEIROS.includes(coluna.tipo)) {
      avisos.push(`"${rotulo}": autoincremento só vale para tipos inteiros.`)
    }
    if (coluna.autoIncremento && coluna.padrao.trim()) {
      avisos.push(`"${rotulo}": coluna com autoincremento não deve ter valor padrão.`)
    }
    for (const [campo, valor] of [['CHECK', coluna.check], ['valor padrão', coluna.padrao]] as const) {
      if (!valor.trim()) continue
      if (!parentesesBalanceados(valor)) avisos.push(`"${rotulo}": o ${campo} tem parênteses desbalanceados.`)
      if (valor.includes(';')) avisos.push(`"${rotulo}": o ${campo} não deve conter ";".`)
    }
  }
}

/**
 * Agrupa as colunas FK de uma tabela em constraints: colunas que apontam pra mesma
 * tabela entram no mesmo grupo enquanto não repetirem a coluna referenciada (PK
 * composta = uma constraint; `origem_id` e `destino_id` → `aeroporto.id` = duas).
 */
function agruparFks(tabela: TabelaPreparada): GrupoFk[] {
  const grupos: GrupoFk[] = []
  for (const preparada of tabela.colunas) {
    const { fk } = preparada.coluna
    if (!fk) continue
    const grupo = grupos.find(
      (existente) =>
        existente.tabelaReferenciadaId === fk.tabelaId && !existente.colunasReferenciadasIds.includes(fk.colunaId),
    )
    if (grupo) {
      grupo.colunas.push(preparada)
      grupo.colunasReferenciadasIds.push(fk.colunaId)
    } else {
      grupos.push({ colunas: [preparada], tabelaReferenciadaId: fk.tabelaId, colunasReferenciadasIds: [fk.colunaId] })
    }
  }
  return grupos
}

/** Ordem de criação: tabela referenciada antes de quem referencia; ciclos no fim, na ordem original. */
function ordenarPorDependencia(tabelas: TabelaPreparada[]): TabelaPreparada[] {
  const dependencias = new Map<string, Set<string>>()
  for (const tabela of tabelas) {
    const alvos = new Set<string>()
    for (const { coluna } of tabela.colunas) {
      if (coluna.fk && coluna.fk.tabelaId !== tabela.tabela.id) alvos.add(coluna.fk.tabelaId)
    }
    dependencias.set(tabela.tabela.id, alvos)
  }

  const ordenadas: TabelaPreparada[] = []
  const criadas = new Set<string>()
  let pendentes = [...tabelas]
  let avancou = true
  while (pendentes.length > 0 && avancou) {
    avancou = false
    for (const tabela of pendentes) {
      const alvos = dependencias.get(tabela.tabela.id) ?? new Set<string>()
      if ([...alvos].every((alvo) => criadas.has(alvo) || !dependencias.has(alvo))) {
        ordenadas.push(tabela)
        criadas.add(tabela.tabela.id)
        avancou = true
        break
      }
    }
    pendentes = pendentes.filter((tabela) => !criadas.has(tabela.tabela.id))
  }
  return [...ordenadas, ...pendentes]
}

function linhaColuna({ coluna, nome }: ColunaPreparada, pkSimples: boolean): string {
  const partes = [`  ${identificadorSql(nome)} ${renderizarTipo(coluna)}`]
  if (coluna.autoIncremento) partes.push('GENERATED BY DEFAULT AS IDENTITY')
  // PK e IDENTITY já implicam NOT NULL no PostgreSQL.
  if (coluna.notNull && !coluna.pk && !coluna.autoIncremento) partes.push('NOT NULL')
  if (coluna.unique && !(coluna.pk && pkSimples)) partes.push('UNIQUE')
  if (coluna.padrao.trim()) partes.push(`DEFAULT ${coluna.padrao.trim()}`)
  if (coluna.check.trim()) partes.push(`CHECK (${coluna.check.trim()})`)
  return partes.join(' ')
}

export function gerarSql(logico: ModeloLogico): SqlGerado {
  const avisos: string[] = []
  const preparadas = prepararTabelas(logico, avisos)
  preparadas.forEach((tabela) => { validarColunas(tabela, avisos) })

  const porId = new Map(preparadas.map((tabela) => [tabela.tabela.id, tabela]))
  const ordem = ordenarPorDependencia(preparadas)
  const posicao = new Map(ordem.map((tabela, indice) => [tabela.tabela.id, indice]))

  const linhasSql: string[] = []
  const alteracoes: string[] = []
  const tabelasGeradas: TabelaGerada[] = []

  ordem.forEach((tabela, indice) => {
    const pks = tabela.colunas.filter(({ coluna }) => coluna.pk)
    const definicoes = tabela.colunas.map((coluna) => linhaColuna(coluna, pks.length === 1))
    if (pks.length > 0) {
      definicoes.push(`  PRIMARY KEY (${pks.map(({ nome }) => identificadorSql(nome)).join(', ')})`)
    }

    for (const grupo of agruparFks(tabela)) {
      const referenciada = porId.get(grupo.tabelaReferenciadaId)
      if (!referenciada) continue
      const colunasReferenciadas = grupo.colunasReferenciadasIds.map((id) =>
        referenciada.colunas.find(({ coluna }) => coluna.id === id),
      )
      if (colunasReferenciadas.some((coluna) => coluna === undefined)) continue
      const referenciadas = colunasReferenciadas.filter((coluna): coluna is ColunaPreparada => coluna !== undefined)

      grupo.colunas.forEach((origem, i) => {
        const destino = referenciadas[i]
        if (destino && renderizarTipo(origem.coluna) !== renderizarTipo(destino.coluna)) {
          avisos.push(
            `"${tabela.nome}.${origem.nome}" (${renderizarTipo(origem.coluna)}) referencia ` +
              `"${referenciada.nome}.${destino.nome}" (${renderizarTipo(destino.coluna)}), de outro tipo.`,
          )
        }
      })
      const pksReferenciada = referenciada.colunas.filter(({ coluna }) => coluna.pk).map(({ coluna }) => coluna.id)
      const ehPkInteira =
        pksReferenciada.length === referenciadas.length && referenciadas.every(({ coluna }) => coluna.pk)
      const ehUnique = referenciadas.length === 1 && referenciadas[0]?.coluna.unique === true
      if (!ehPkInteira && !ehUnique) {
        avisos.push(
          `A chave estrangeira de "${tabela.nome}" para "${referenciada.nome}" precisa referenciar a chave ` +
            'primária inteira ou uma coluna UNIQUE.',
        )
      }

      const nomeConstraint = `fk_${tabela.nome}_${grupo.colunas[0]?.nome ?? 'coluna'}`.slice(0, LIMITE_IDENTIFICADOR_POSTGRES)
      const clausula =
        `CONSTRAINT ${nomeConstraint} FOREIGN KEY (${grupo.colunas.map(({ nome }) => identificadorSql(nome)).join(', ')}) ` +
        `REFERENCES ${identificadorSql(referenciada.nome)} (${referenciadas.map(({ nome }) => identificadorSql(nome)).join(', ')})`

      // Referência a tabela que ainda não foi criada (ciclo) vai pra ALTER TABLE no fim.
      if ((posicao.get(referenciada.tabela.id) ?? 0) > indice) {
        alteracoes.push(`ALTER TABLE ${identificadorSql(tabela.nome)} ADD ${clausula};`)
      } else {
        definicoes.push(`  ${clausula}`)
      }
    }

    if (linhasSql.length > 0) linhasSql.push('')
    const linhaInicio = linhasSql.length + 1
    linhasSql.push(`CREATE TABLE ${identificadorSql(tabela.nome)} (`)
    if (definicoes.length > 0) linhasSql.push(...definicoes.join(',\n').split('\n'))
    linhasSql.push(');')
    tabelasGeradas.push({
      id: tabela.tabela.id,
      nome: tabela.nome,
      colunas: tabela.colunas.map(({ coluna, nome }) => ({ id: coluna.id, nome })),
      linhaInicio,
      linhaFim: linhasSql.length,
    })
  })

  if (alteracoes.length > 0) linhasSql.push('', ...alteracoes)
  return { sql: linhasSql.join('\n'), avisos, tabelas: tabelasGeradas }
}
