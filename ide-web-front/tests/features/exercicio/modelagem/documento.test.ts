import { describe, expect, it, vi } from 'vitest'
import {
  documentoModelagemSchema,
  DOCUMENTO_VAZIO,
  erroDeValidacao,
  LIMITES,
  parseDocumento,
  resumirDocumento,
} from '../../../../src/features/exercicio/modelagem/documento'
import type {
  Coluna,
  DocumentoModelagem,
  ModeloConceitual,
} from '../../../../src/features/exercicio/modelagem/documento'

function coluna(id: string, mudancas: Partial<Coluna> = {}): Coluna {
  return {
    id,
    nome: id,
    tipo: 'INTEGER',
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

const posicao = { x: 0, y: 0 }

function conceitualValido(): ModeloConceitual {
  return {
    visaoAtributos: 'circulos',
    elementos: [
      { id: 'e1', tipo: 'entidade', posicao, nome: 'cliente' },
      { id: 'e2', tipo: 'entidade', posicao, nome: 'pedido' },
      { id: 'r1', tipo: 'relacionamento', posicao, nome: 'faz', associativa: false },
      { id: 'a1', tipo: 'atributo', posicao, nome: 'id', paiId: 'e1', chave: true, cardinalidade: '(1,1)', tipoSugerido: null },
      { id: 'a2', tipo: 'atributo', posicao, nome: 'endereco', paiId: 'e1', chave: false, cardinalidade: '(1,1)', tipoSugerido: null },
      { id: 'a3', tipo: 'atributo', posicao, nome: 'rua', paiId: 'a2', chave: false, cardinalidade: '(1,1)', tipoSugerido: null },
      { id: 's1', tipo: 'especializacao', posicao, paiId: 'e1', total: true, disjunta: true },
      { id: 'n1', tipo: 'nota', posicao, texto: 'lembrete' },
    ],
    ligacoes: [
      { id: 'p1', tipo: 'participacao', relacionamentoId: 'r1', entidadeId: 'e1', min: 1, max: '1', papel: '' },
      { id: 'p2', tipo: 'participacao', relacionamentoId: 'r1', entidadeId: 'e2', min: 0, max: 'n', papel: '' },
    ],
  }
}

function documento(mudancas: Partial<DocumentoModelagem>): DocumentoModelagem {
  return { ...DOCUMENTO_VAZIO, ...mudancas }
}

describe('documento de modelagem', () => {
  it('aceita documento completo com conceitual, lógico e conversão', () => {
    const valido = documento({
      conceitual: conceitualValido(),
      logico: {
        tabelas: [
          { id: 't1', posicao, nome: 'cliente', colunas: [coluna('c1', { pk: true })] },
          { id: 't2', posicao, nome: 'pedido', colunas: [coluna('c2', { fk: { tabelaId: 't1', colunaId: 'c1' } })] },
        ],
        notas: [{ id: 'n2', posicao, texto: '' }],
      },
      conversao: { assinaturaConceitual: 'abc', convertidoEm: '2026-09-15T10:00:00.000Z', escolhas: { r1: 'fk_lado_total' } },
    })

    expect(parseDocumento(valido)).toEqual(valido)
    expect(erroDeValidacao(valido)).toBeNull()
  })

  it('carrega vazio (sem quebrar) o formato antigo da Fase 6', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(parseDocumento({ nodes: [], edges: [] })).toEqual(DOCUMENTO_VAZIO)
    expect(parseDocumento(null)).toEqual(DOCUMENTO_VAZIO)
    expect(aviso).toHaveBeenCalledTimes(1)
    aviso.mockRestore()
  })

  it('recusa chave estrangeira apontando para coluna inexistente', () => {
    const invalido = documento({
      logico: { tabelas: [{ id: 't1', posicao, nome: 'a', colunas: [coluna('c1', { fk: { tabelaId: 't9', colunaId: 'c9' } })] }], notas: [] },
    })

    expect(documentoModelagemSchema.safeParse(invalido).success).toBe(false)
    expect(erroDeValidacao(invalido)).toContain('chave estrangeira aponta para coluna inexistente')
  })

  it('recusa ids repetidos no lógico', () => {
    const invalido = documento({
      logico: { tabelas: [{ id: 'x', posicao, nome: 'a', colunas: [coluna('x')] }], notas: [] },
    })

    expect(erroDeValidacao(invalido)).toContain('id repetido: x')
  })

  it.each([
    ['atributo sem pai', (m: ModeloConceitual) => { m.elementos.push({ id: 'a9', tipo: 'atributo', posicao, nome: 'x', paiId: 'nada', chave: false, cardinalidade: '(1,1)', tipoSugerido: null }) }, 'atributo sem entidade'],
    ['participação ligando dois relacionamentos', (m: ModeloConceitual) => {
      m.elementos.push({ id: 'r2', tipo: 'relacionamento', posicao, nome: 'outro', associativa: false })
      m.ligacoes.push({ id: 'p9', tipo: 'participacao', relacionamentoId: 'r1', entidadeId: 'r2', min: 0, max: 'n', papel: '' })
    }, 'participação sem entidade'],
    ['especialização sem entidade genérica', (m: ModeloConceitual) => { m.elementos.push({ id: 's9', tipo: 'especializacao', posicao, paiId: 'r1', total: false, disjunta: false }) }, 'especialização sem entidade genérica'],
    ['filho de especialização que não é entidade', (m: ModeloConceitual) => { m.ligacoes.push({ id: 'f9', tipo: 'filho_especializacao', especializacaoId: 's1', entidadeId: 'r1' }) }, 'filho de especialização sem entidade'],
    ['ciclo de atributos', (m: ModeloConceitual) => {
      m.elementos.push(
        { id: 'c1', tipo: 'atributo', posicao, nome: 'x', paiId: 'c2', chave: false, cardinalidade: '(1,1)', tipoSugerido: null },
        { id: 'c2', tipo: 'atributo', posicao, nome: 'y', paiId: 'c1', chave: false, cardinalidade: '(1,1)', tipoSugerido: null },
      )
    }, 'atributos formam um ciclo'],
  ])('recusa conceitual inconsistente: %s', (_nome, estragar, mensagem) => {
    const conceitual = conceitualValido()
    estragar(conceitual)

    expect(erroDeValidacao(documento({ conceitual }))).toContain(mensagem)
  })

  it('aceita participação de relacionamento associativo como entidade', () => {
    const conceitual = conceitualValido()
    conceitual.elementos.push({ id: 'r2', tipo: 'relacionamento', posicao, nome: 'item', associativa: true })
    conceitual.ligacoes.push({ id: 'p9', tipo: 'participacao', relacionamentoId: 'r1', entidadeId: 'r2', min: 0, max: 'n', papel: '' })

    expect(erroDeValidacao(documento({ conceitual }))).toBeNull()
  })

  it('traduz estouro de limite numa mensagem legível', () => {
    const tabelas = Array.from({ length: LIMITES.tabelas + 1 }, (_, i) => ({
      id: `t${String(i)}`,
      posicao,
      nome: `t${String(i)}`,
      colunas: [],
    }))

    expect(erroDeValidacao(documento({ logico: { tabelas, notas: [] } }))).toBe(
      'O modelo passou do tamanho máximo permitido (muitos elementos ou texto longo demais).',
    )
  })

  it('resume o conteúdo para a lista de exercícios', () => {
    expect(resumirDocumento(DOCUMENTO_VAZIO)).toBe('vazio')
    expect(
      resumirDocumento(
        documento({ conceitual: conceitualValido(), logico: { tabelas: [{ id: 't', posicao, nome: 'a', colunas: [] }], notas: [] } }),
      ),
    ).toBe('2 entidades, 1 tabela')
  })
})
