import { describe, expect, it } from 'vitest';
import type { ModeloConceitual } from '../../src/dtos/modelagem.schema';
import { resumirConceitual } from '../../src/utils/modelagem/resumoConceitual';

const POSICAO = { x: 0, y: 0 };

function conceitual(parcial: Partial<ModeloConceitual>): ModeloConceitual {
  return { elementos: [], ligacoes: [], visaoAtributos: 'circulos', ...parcial };
}

describe('resumirConceitual', () => {
  it('descreve entidades com identificador, composto e multivalorado', () => {
    const resumo = resumirConceitual(
      conceitual({
        elementos: [
          { id: 'e1', posicao: POSICAO, tipo: 'entidade', nome: 'aluno' },
          { id: 'a1', posicao: POSICAO, tipo: 'atributo', nome: 'matricula', paiId: 'e1', chave: true, cardinalidade: '(1,1)', tipoSugerido: null },
          { id: 'a2', posicao: POSICAO, tipo: 'atributo', nome: 'endereco', paiId: 'e1', chave: false, cardinalidade: '(1,1)', tipoSugerido: null },
          { id: 'a3', posicao: POSICAO, tipo: 'atributo', nome: 'rua', paiId: 'a2', chave: false, cardinalidade: '(1,1)', tipoSugerido: null },
          { id: 'a4', posicao: POSICAO, tipo: 'atributo', nome: 'telefone', paiId: 'e1', chave: false, cardinalidade: '(0,n)', tipoSugerido: null },
        ],
      }),
    );

    expect(resumo).toContain('Entidade aluno:');
    expect(resumo).toContain('matricula [identificador]');
    expect(resumo).toContain('endereco [composto por rua]');
    expect(resumo).toContain('telefone [multivalorado]');
  });

  it('descreve o relacionamento com a cardinalidade de cada participação', () => {
    const resumo = resumirConceitual(
      conceitual({
        elementos: [
          { id: 'e1', posicao: POSICAO, tipo: 'entidade', nome: 'aluno' },
          { id: 'e2', posicao: POSICAO, tipo: 'entidade', nome: 'turma' },
          { id: 'r1', posicao: POSICAO, tipo: 'relacionamento', nome: 'matricula_em', associativa: false },
        ],
        ligacoes: [
          { id: 'p1', tipo: 'participacao', relacionamentoId: 'r1', entidadeId: 'e1', min: 1, max: 'n', papel: '' },
          { id: 'p2', tipo: 'participacao', relacionamentoId: 'r1', entidadeId: 'e2', min: 1, max: '1', papel: '' },
        ],
      }),
    );

    expect(resumo).toContain('Relacionamento matricula_em: aluno (1,n) — turma (1,1)');
  });

  it('descreve especialização com total/parcial e disjunta/sobreposta', () => {
    const resumo = resumirConceitual(
      conceitual({
        elementos: [
          { id: 'e1', posicao: POSICAO, tipo: 'entidade', nome: 'pessoa' },
          { id: 'e2', posicao: POSICAO, tipo: 'entidade', nome: 'aluno' },
          { id: 's1', posicao: POSICAO, tipo: 'especializacao', paiId: 'e1', total: true, disjunta: false },
        ],
        ligacoes: [{ id: 'f1', tipo: 'filho_especializacao', especializacaoId: 's1', entidadeId: 'e2' }],
      }),
    );

    expect(resumo).toContain('Especialização de pessoa em aluno (total, sobreposta)');
  });

  it('não gera linha nenhuma para um conceitual vazio', () => {
    expect(resumirConceitual(conceitual({}))).toBe('');
  });
});
