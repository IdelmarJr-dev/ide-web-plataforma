import { describe, expect, it } from 'vitest'
import type { Coluna, ModeloLogico, Tabela } from '../../../../src/features/exercicio/modelagem/documento'
import { problemasDoLogico } from '../../../../src/features/exercicio/modelagem/documento'
import {
  adicionarColuna,
  adicionarTabela,
  atualizarColuna,
  colunaPadrao,
  duplicarTabela,
  ligacoesFk,
  ligarTabelas,
  moverColuna,
  normalizarColuna,
  removerColuna,
  removerLigacao,
  removerTabela,
} from '../../../../src/features/exercicio/modelagem/logico/operacoes'

function col(id: string, nome: string, mudancas: Partial<Coluna> = {}): Coluna {
  return { ...colunaPadrao(nome, mudancas), id }
}

function tabela(id: string, nome: string, colunas: Coluna[]): Tabela {
  return { id, posicao: { x: 0, y: 0 }, nome, colunas }
}

function modelo(...tabelas: Tabela[]): ModeloLogico {
  return { tabelas, notas: [] }
}

function colunasDe(logico: ModeloLogico, tabelaId: string): Coluna[] {
  return logico.tabelas.find((t) => t.id === tabelaId)?.colunas ?? []
}

const cliente = tabela('tc', 'Cliente', [col('c1', 'id', { tipo: 'INTEGER', pk: true, notNull: true })])
const pedido = tabela('tp', 'pedido', [col('p1', 'id', { tipo: 'INTEGER', pk: true, notNull: true })])

describe('operações do modelo lógico', () => {
  it('nova tabela nasce com id INTEGER como chave primária e nome único', () => {
    const { logico, tabelaId } = adicionarTabela(modelo(tabela('x', 'tabela1', [])), { x: 10, y: 20 })
    const criada = logico.tabelas.find((t) => t.id === tabelaId)

    expect(criada?.nome).toBe('tabela2')
    expect(criada?.posicao).toEqual({ x: 10, y: 20 })
    expect(criada?.colunas).toMatchObject([{ nome: 'id', tipo: 'INTEGER', pk: true, notNull: true }])
  })

  it('nova coluna ganha nome único dentro da tabela', () => {
    const base = modelo(tabela('t', 'a', [col('k1', 'coluna2')]))
    const { logico } = adicionarColuna(base, 't')

    expect(colunasDe(logico, 't').map((c) => c.nome)).toEqual(['coluna2', 'coluna2_2'])
  })

  it('ligar tabelas cria a FK com nome e tipo reais da PK de origem', () => {
    const origem = tabela('tc', 'Cliente', [col('c1', 'codigo', { tipo: 'VARCHAR', tamanho: 10, pk: true, notNull: true })])
    const resultado = ligarTabelas(modelo(origem, pedido), 'tc', 'tp')

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(colunasDe(resultado.logico, 'tp')[1]).toMatchObject({
      nome: 'cliente_codigo',
      tipo: 'VARCHAR',
      tamanho: 10,
      pk: false,
      notNull: true,
      fk: { tabelaId: 'tc', colunaId: 'c1' },
    })
    expect(problemasDoLogico(resultado.logico)).toEqual([])
  })

  it('ligar tabela com PK composta cria uma coluna por parte da chave', () => {
    const matricula = tabela('tm', 'matricula', [col('m1', 'aluno_id', { pk: true }), col('m2', 'disciplina_id', { pk: true })])
    const nota = tabela('tn', 'nota', [col('n1', 'id', { pk: true })])
    const resultado = ligarTabelas(modelo(matricula, nota), 'tm', 'tn')

    expect(resultado.ok && colunasDe(resultado.logico, 'tn').map((c) => c.nome)).toEqual([
      'id',
      'matricula_aluno_id',
      'matricula_disciplina_id',
    ])
  })

  it('recusa ligar a partir de tabela sem chave primária', () => {
    expect(ligarTabelas(modelo(tabela('ta', 'avulsa', [col('a1', 'x')]), pedido), 'ta', 'tp')).toEqual({
      ok: false,
      erro: 'Defina a chave primária de "avulsa" antes de ligar as tabelas.',
    })
  })

  it('auto-relacionamento cria FK opcional e evita nome repetido', () => {
    const funcionario = tabela('tf', 'funcionario', [col('f1', 'id', { pk: true }), col('f2', 'funcionario_id')])
    const resultado = ligarTabelas(modelo(funcionario), 'tf', 'tf')

    expect(resultado.ok && colunasDe(resultado.logico, 'tf')[2]).toMatchObject({ nome: 'funcionario_id_2', notNull: false })
  })

  it('calcula as ligações e o (mín,máx) a partir das FKs', () => {
    const base = modelo(
      cliente,
      tabela('tp', 'pedido', [
        col('p1', 'id', { pk: true }),
        col('p2', 'cliente_id', { notNull: true, fk: { tabelaId: 'tc', colunaId: 'c1' } }),
      ]),
      tabela('td', 'documento', [col('d1', 'cliente_id', { unique: true, fk: { tabelaId: 'tc', colunaId: 'c1' } })]),
      tabela('tpf', 'pessoa_fisica', [col('pf1', 'cliente_id', { pk: true, notNull: true, fk: { tabelaId: 'tc', colunaId: 'c1' } })]),
    )

    expect(ligacoesFk(base)).toEqual([
      { id: 'fk:tp:p2', tabelaReferenciadaId: 'tc', tabelaId: 'tp', colunaIds: ['p2'], cardinalidadeReferenciada: '(1,1)', cardinalidadeReferenciadora: '(0,n)' },
      { id: 'fk:td:d1', tabelaReferenciadaId: 'tc', tabelaId: 'td', colunaIds: ['d1'], cardinalidadeReferenciada: '(0,1)', cardinalidadeReferenciadora: '(0,1)' },
      { id: 'fk:tpf:pf1', tabelaReferenciadaId: 'tc', tabelaId: 'tpf', colunaIds: ['pf1'], cardinalidadeReferenciada: '(1,1)', cardinalidadeReferenciadora: '(0,1)' },
    ])
  })

  it('remover ligação apaga as colunas FK que ela criou', () => {
    const ligado = ligarTabelas(modelo(cliente, pedido), 'tc', 'tp')
    if (!ligado.ok) throw new Error('deveria ligar')
    const [ligacao] = ligacoesFk(ligado.logico)
    if (!ligacao) throw new Error('deveria ter ligação')

    expect(colunasDe(removerLigacao(ligado.logico, ligacao), 'tp').map((c) => c.nome)).toEqual(['id'])
  })

  it('remover coluna ou tabela referenciada desfaz as FKs dependentes sem apagar as colunas', () => {
    const base = modelo(cliente, tabela('tp', 'pedido', [col('p2', 'cliente_id', { fk: { tabelaId: 'tc', colunaId: 'c1' } })]))

    const semColuna = removerColuna(base, 'tc', 'c1')
    expect(colunasDe(semColuna, 'tp')[0]?.fk).toBeNull()
    expect(problemasDoLogico(semColuna)).toEqual([])

    const semTabela = removerTabela(base, 'tc')
    expect(semTabela.tabelas.map((t) => t.id)).toEqual(['tp'])
    expect(colunasDe(semTabela, 'tp')[0]).toMatchObject({ nome: 'cliente_id', fk: null })
  })

  it('mudar o tipo da PK propaga para as FKs que apontam para ela', () => {
    const base = modelo(cliente, tabela('tp', 'pedido', [col('p2', 'cliente_id', { fk: { tabelaId: 'tc', colunaId: 'c1' } })]))
    const atualizado = atualizarColuna(base, 'tc', 'c1', { tipo: 'VARCHAR', tamanho: 20 })

    expect(colunasDe(atualizado, 'tp')[0]).toMatchObject({ tipo: 'VARCHAR', tamanho: 20 })
  })

  it('normaliza invariantes da coluna', () => {
    expect(normalizarColuna(col('x', 'x', { tipo: 'TEXT', tamanho: 5, autoIncremento: true }))).toMatchObject({
      tamanho: null,
      autoIncremento: false,
      notNull: false,
    })
    expect(normalizarColuna(col('x', 'x', { pk: true }))).toMatchObject({ notNull: true })
    expect(normalizarColuna(col('x', 'x', { tipo: 'BIGINT', autoIncremento: true }))).toMatchObject({ notNull: true })
    expect(normalizarColuna(col('x', 'x', { tipo: 'VARCHAR', tamanho: 9, escala: 2 }))).toMatchObject({ tamanho: 9, escala: null })
  })

  it('move coluna para cima e para baixo sem sair dos limites', () => {
    const base = modelo(tabela('t', 't', [col('a', 'a'), col('b', 'b')]))

    expect(colunasDe(moverColuna(base, 't', 'b', -1), 't').map((c) => c.id)).toEqual(['b', 'a'])
    expect(moverColuna(base, 't', 'b', 1).tabelas[0]?.colunas.map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('duplica tabela com ids novos e auto-referência apontando para a cópia', () => {
    const funcionario = tabela('tf', 'funcionario', [
      col('f1', 'id', { pk: true }),
      col('f2', 'gerente_id', { fk: { tabelaId: 'tf', colunaId: 'f1' } }),
    ])
    const resultado = duplicarTabela(modelo(funcionario), 'tf')
    if (!resultado) throw new Error('deveria duplicar')
    const copia = resultado.logico.tabelas.find((t) => t.id === resultado.tabelaId)

    expect(copia?.nome).toBe('funcionario_copia')
    expect(copia?.colunas[1]?.fk).toEqual({ tabelaId: resultado.tabelaId, colunaId: copia?.colunas[0]?.id })
    expect(problemasDoLogico(resultado.logico)).toEqual([])
  })
})
