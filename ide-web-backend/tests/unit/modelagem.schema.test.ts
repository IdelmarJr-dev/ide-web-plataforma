import { describe, expect, it } from 'vitest';
import { salvarDiagramaBodySchema } from '../../src/dtos/diagrama.dto';
import { pedirDicaBodySchema } from '../../src/dtos/dicaIa.dto';
import { atualizarExercicioBodySchema, criarExercicioBodySchema } from '../../src/dtos/exercicio.dto';
import type { Coluna, DocumentoModelagem } from '../../src/dtos/modelagem.schema';
import { documentoModelagemSchema, LIMITES } from '../../src/dtos/modelagem.schema';

const posicao = { x: 0, y: 0 };

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
  };
}

const VAZIO: DocumentoModelagem = { versao: 2, conceitual: null, logico: null, conversao: null };

const COMPLETO: DocumentoModelagem = {
  versao: 2,
  conceitual: {
    visaoAtributos: 'lista',
    elementos: [
      { id: 'e1', tipo: 'entidade', posicao, nome: 'cliente' },
      { id: 'e2', tipo: 'entidade', posicao, nome: 'pedido' },
      { id: 'r1', tipo: 'relacionamento', posicao, nome: 'faz', associativa: false },
      { id: 'a1', tipo: 'atributo', posicao, nome: 'id', paiId: 'e1', chave: true, cardinalidade: '(1,1)', tipoSugerido: null },
      { id: 's1', tipo: 'especializacao', posicao, paiId: 'e1', total: true, disjunta: false },
      { id: 'n1', tipo: 'nota', posicao, texto: 'x' },
    ],
    ligacoes: [
      { id: 'p1', tipo: 'participacao', relacionamentoId: 'r1', entidadeId: 'e1', min: 1, max: '1', papel: '' },
      { id: 'p2', tipo: 'participacao', relacionamentoId: 'r1', entidadeId: 'e2', min: 0, max: 'n', papel: '' },
    ],
  },
  logico: {
    tabelas: [
      { id: 't1', posicao, nome: 'cliente', colunas: [coluna('c1', { pk: true })] },
      { id: 't2', posicao, nome: 'pedido', colunas: [coluna('c2', { fk: { tabelaId: 't1', colunaId: 'c1' } })] },
    ],
    notas: [],
  },
  conversao: { assinaturaConceitual: 'abc', convertidoEm: '2026-09-15T10:00:00.000Z', escolhas: { r1: 'fk_lado_total' } },
};

describe('documentoModelagemSchema', () => {
  it('aceita documento vazio e completo', () => {
    expect(documentoModelagemSchema.safeParse(VAZIO).success).toBe(true);
    expect(documentoModelagemSchema.parse(COMPLETO)).toEqual(COMPLETO);
  });

  it('ignora o campo `modo` dos documentos salvos antes da retirada do "aluno escolhe"', () => {
    const salvoAntes = { ...VAZIO, modo: 'conceitual_logico' };

    const resultado = documentoModelagemSchema.parse(salvoAntes);

    expect(resultado).toEqual(VAZIO);
    expect(resultado).not.toHaveProperty('modo');
  });

  it('recusa o formato antigo da Fase 6', () => {
    expect(documentoModelagemSchema.safeParse({ nodes: [], edges: [] }).success).toBe(false);
  });

  it('recusa FK apontando para coluna inexistente e ids repetidos', () => {
    const fkQuebrada = {
      ...VAZIO,
      logico: { tabelas: [{ id: 't1', posicao, nome: 'a', colunas: [coluna('c1', { fk: { tabelaId: 'x', colunaId: 'y' } })] }], notas: [] },
    };
    const idRepetido = { ...VAZIO, logico: { tabelas: [{ id: 'x', posicao, nome: 'a', colunas: [coluna('x')] }], notas: [] } };

    expect(documentoModelagemSchema.safeParse(fkQuebrada).success).toBe(false);
    expect(documentoModelagemSchema.safeParse(idRepetido).success).toBe(false);
  });

  it('recusa conceitual com participação ligada a algo que não é entidade', () => {
    const conceitual = COMPLETO.conceitual;
    if (!conceitual) throw new Error('fixture sem conceitual');
    const invalido = {
      ...COMPLETO,
      conceitual: {
        ...conceitual,
        ligacoes: [...conceitual.ligacoes, { id: 'p9', tipo: 'participacao', relacionamentoId: 'r1', entidadeId: 'a1', min: 0, max: 'n', papel: '' }],
      },
    };

    expect(documentoModelagemSchema.safeParse(invalido).success).toBe(false);
  });

  it('aplica os limites de tamanho', () => {
    const tabelas = Array.from({ length: LIMITES.tabelas + 1 }, (_, i) => ({ id: `t${String(i)}`, posicao, nome: 't', colunas: [] }));
    const nomeLongo = { ...VAZIO, logico: { tabelas: [{ id: 't', posicao, nome: 'x'.repeat(64), colunas: [] }], notas: [] } };

    expect(documentoModelagemSchema.safeParse({ ...VAZIO, logico: { tabelas, notas: [] } }).success).toBe(false);
    expect(documentoModelagemSchema.safeParse(nomeLongo).success).toBe(false);
  });
});

describe('DTOs que usam o documento de modelagem', () => {
  const baseExercicio = {
    turmaId: '8f14e45f-ceea-467f-a9f5-2b1a0e6b1b2a',
    titulo: 't',
    enunciado: 'e',
    nivelDificuldade: 'iniciante',
    ordem: 1,
  };

  it('exercício aceita gabarito v2 e nível da modelagem válido', () => {
    expect(criarExercicioBodySchema.safeParse({ ...baseExercicio, merGabarito: COMPLETO, modoMer: 'logico' }).success).toBe(true);
    expect(criarExercicioBodySchema.safeParse({ ...baseExercicio, modoMer: 'livre' }).success).toBe(false);
    expect(atualizarExercicioBodySchema.safeParse({ merGabarito: { nodes: [], edges: [] } }).success).toBe(false);
  });

  it('salvar diagrama exige o documento v2', () => {
    expect(salvarDiagramaBodySchema.safeParse({ conteudoJson: VAZIO }).success).toBe(true);
    expect(salvarDiagramaBodySchema.safeParse({ conteudoJson: { nodes: [], edges: [] } }).success).toBe(false);
  });

  it('dica de modelagem exige ao menos uma entidade ou tabela', () => {
    expect(pedirDicaBodySchema.safeParse({ contexto: 'mer', estadoMer: VAZIO }).success).toBe(false);
    expect(pedirDicaBodySchema.safeParse({ contexto: 'mer', estadoMer: COMPLETO }).success).toBe(true);
  });
});
