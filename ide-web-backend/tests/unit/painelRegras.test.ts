import { describe, expect, it } from 'vitest';
import type { Exercicio, ResultadoExercicio } from '../../src/generated/prisma/client';
import {
  aguardaRevisao,
  estadoDaCelula,
  exercicioVisivelParaAluno,
  temCorrecaoManual,
} from '../../src/utils/painel';

type ParteExercicio = Pick<Exercicio, 'publico' | 'mer_gabarito' | 'gabarito_dissertativo'>;
type ParteResultado = Pick<ResultadoExercicio, 'finalizado_em' | 'revisado' | 'sql_correto'>;

const SO_SQL: ParteExercicio = { publico: false, mer_gabarito: null, gabarito_dissertativo: null };
const COM_MER: ParteExercicio = { publico: false, mer_gabarito: {}, gabarito_dissertativo: null };
const PUBLICO_COM_MER: ParteExercicio = { publico: true, mer_gabarito: {}, gabarito_dissertativo: null };

function resultado(overrides: Partial<ParteResultado> = {}): ParteResultado {
  return { finalizado_em: null, revisado: false, sql_correto: null, ...overrides };
}

describe('exercicioVisivelParaAluno', () => {
  // Fase 9, D3
  it('exercício solto aparece pra turma inteira', () => {
    expect(exercicioVisivelParaAluno(null, null)).toBe(true);
    expect(exercicioVisivelParaAluno(null, 'prova-a')).toBe(true);
  });

  it('exercício de prova só aparece pra quem foi sorteado com ela', () => {
    expect(exercicioVisivelParaAluno('prova-a', 'prova-a')).toBe(true);
    expect(exercicioVisivelParaAluno('prova-a', 'prova-b')).toBe(false);
    expect(exercicioVisivelParaAluno('prova-a', null)).toBe(false);
    expect(exercicioVisivelParaAluno('prova-a', undefined)).toBe(false);
  });
});

describe('temCorrecaoManual / aguardaRevisao', () => {
  // Fase 9, D4
  it('exercício só de SQL nunca espera correção humana', () => {
    expect(temCorrecaoManual(SO_SQL)).toBe(false);
    expect(aguardaRevisao(SO_SQL, resultado({ finalizado_em: new Date() }))).toBe(false);
  });

  it('exercício público não entra na fila, mesmo tendo modelagem', () => {
    expect(temCorrecaoManual(PUBLICO_COM_MER)).toBe(false);
  });

  it('entra na fila quando foi finalizado, tem parte manual e ninguém revisou', () => {
    expect(aguardaRevisao(COM_MER, resultado({ finalizado_em: new Date() }))).toBe(true);
  });

  it('sai da fila depois de revisado', () => {
    expect(aguardaRevisao(COM_MER, resultado({ finalizado_em: new Date(), revisado: true }))).toBe(false);
  });

  it('não entra na fila enquanto o aluno não finalizou', () => {
    expect(aguardaRevisao(COM_MER, resultado())).toBe(false);
    expect(aguardaRevisao(COM_MER, null)).toBe(false);
  });
});

describe('estadoDaCelula', () => {
  it('sem resultado e sem atividade, o aluno não começou', () => {
    expect(estadoDaCelula(SO_SQL, null, false)).toBe('nao_iniciou');
  });

  it('atividade sem entrega é "em andamento"', () => {
    expect(estadoDaCelula(SO_SQL, null, true)).toBe('em_andamento');
    expect(estadoDaCelula(SO_SQL, resultado(), true)).toBe('em_andamento');
  });

  it('finalizado sem acerto avaliado é "entregue"', () => {
    expect(estadoDaCelula(SO_SQL, resultado({ finalizado_em: new Date() }), true)).toBe('entregue');
  });

  it('acerto automático vira "correto"', () => {
    expect(estadoDaCelula(SO_SQL, resultado({ sql_correto: true }), true)).toBe('correto');
  });

  it('erro automático não vira "correto"', () => {
    expect(estadoDaCelula(SO_SQL, resultado({ sql_correto: false }), true)).toBe('em_andamento');
  });

  // A precedência importa: SQL certo e modelagem por corrigir ainda é trabalho pendente.
  it('"aguardando revisão" vence "correto" quando há parte manual pendente', () => {
    const estado = estadoDaCelula(COM_MER, resultado({ finalizado_em: new Date(), sql_correto: true }), true);

    expect(estado).toBe('aguardando_revisao');
  });

  it('depois de revisado, o acerto volta a aparecer', () => {
    const estado = estadoDaCelula(
      COM_MER,
      resultado({ finalizado_em: new Date(), revisado: true, sql_correto: true }),
      true,
    );

    expect(estado).toBe('correto');
  });
});
