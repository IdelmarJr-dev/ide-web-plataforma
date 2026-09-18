import { describe, expect, it } from 'vitest'
import type { TabelaGerada } from '../../../../src/features/exercicio/modelagem/gerarSql'
import {
  extrairAliases,
  identificadorNaPosicao,
  mascararStringsEComentarios,
  ocorrenciasNoSql,
  resolverSelecao,
} from '../../../../src/features/exercicio/modelagem/sincronizacao'

const TABELAS: TabelaGerada[] = [
  { id: 'c', nome: 'cliente', colunas: [{ id: 'c1', nome: 'id' }, { id: 'c2', nome: 'nome' }], linhaInicio: 1, linhaFim: 5 },
  {
    id: 'p',
    nome: 'pedido',
    colunas: [{ id: 'p1', nome: 'id' }, { id: 'p2', nome: 'data' }, { id: 'p3', nome: 'cliente_id' }],
    linhaInicio: 7,
    linhaFim: 12,
  },
]

function trechos(sql: string, intervalos: { inicio: number; fim: number }[]): string[] {
  return intervalos.map(({ inicio, fim }) => sql.slice(inicio, fim))
}

describe('identificadorNaPosicao', () => {
  const sql = 'SELECT c.nome FROM Cliente c'

  it('reconhece identificador qualificado sob o cursor', () => {
    expect(identificadorNaPosicao(sql, sql.indexOf('nome') + 1)).toEqual({ qualificador: 'c', nome: 'nome' })
  })

  it('reconhece identificador simples e normaliza', () => {
    expect(identificadorNaPosicao(sql, sql.indexOf('Cliente') + 2)).toEqual({ qualificador: null, nome: 'cliente' })
  })

  it('ignora palavras reservadas e texto dentro de string', () => {
    expect(identificadorNaPosicao(sql, 2)).toBeNull()
    const comString = "SELECT * FROM cliente WHERE nome = 'pedido'"
    expect(identificadorNaPosicao(comString, comString.indexOf('pedido') + 1)).toBeNull()
  })
})

describe('extrairAliases', () => {
  it('lê aliases de FROM e JOIN, com e sem AS', () => {
    const aliases = extrairAliases('SELECT * FROM cliente c JOIN pedido AS p ON p.cliente_id = c.id WHERE 1 = 1')

    expect(aliases.get('c')).toBe('cliente')
    expect(aliases.get('p')).toBe('pedido')
  })

  it('não confunde palavra reservada com alias', () => {
    expect(extrairAliases('SELECT * FROM cliente WHERE id = 1').size).toBe(0)
  })
})

describe('resolverSelecao', () => {
  const aliases = new Map([['p', 'pedido']])

  it('alias qualificado vira tabela + coluna', () => {
    expect(resolverSelecao({ qualificador: 'p', nome: 'data' }, TABELAS, aliases)).toEqual({
      tabela: 'pedido',
      coluna: 'data',
    })
  })

  it('nome de tabela vira só tabela', () => {
    expect(resolverSelecao({ qualificador: null, nome: 'cliente' }, TABELAS, aliases)).toEqual({
      tabela: 'cliente',
      coluna: null,
    })
  })

  it('coluna que só existe numa tabela resolve a tabela dona', () => {
    expect(resolverSelecao({ qualificador: null, nome: 'cliente_id' }, TABELAS, aliases)).toEqual({
      tabela: 'pedido',
      coluna: 'cliente_id',
    })
  })

  it('coluna ambígua destaca a coluna sem fixar tabela', () => {
    expect(resolverSelecao({ qualificador: null, nome: 'id' }, TABELAS, aliases)).toEqual({ tabela: null, coluna: 'id' })
  })

  it('identificador que não existe no MER não seleciona nada', () => {
    expect(resolverSelecao({ qualificador: null, nome: 'produto' }, TABELAS, aliases)).toBeNull()
  })
})

describe('ocorrenciasNoSql', () => {
  const sql = "SELECT p.data, cliente.nome FROM cliente JOIN pedido p ON p.cliente_id = cliente.id -- cliente"
  const aliases = extrairAliases(sql)

  it('entidade selecionada destaca o nome da tabela e seus aliases, fora de comentários', () => {
    expect(trechos(sql, ocorrenciasNoSql(sql, { tabela: 'pedido', coluna: null }, aliases))).toEqual([
      'p',
      'pedido',
      'p',
      'p',
    ])
    expect(ocorrenciasNoSql(sql, { tabela: 'cliente', coluna: null }, aliases)).toHaveLength(3)
  })

  it('atributo selecionado destaca só a coluna daquela tabela', () => {
    expect(trechos(sql, ocorrenciasNoSql(sql, { tabela: 'pedido', coluna: 'data' }, aliases))).toEqual(['data'])
  })
})

describe('mascararStringsEComentarios', () => {
  it('preserva o tamanho do texto', () => {
    const sql = "SELECT 'a' -- x\n/* y */ FROM t"
    expect(mascararStringsEComentarios(sql)).toHaveLength(sql.length)
  })
})
