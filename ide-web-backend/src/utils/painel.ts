import type { Exercicio, ResultadoExercicio } from '../generated/prisma/client';

export const ESTADOS_CELULA = [
  'nao_iniciou',
  'em_andamento',
  'entregue',
  'correto',
  'aguardando_revisao',
] as const;

export type EstadoCelula = (typeof ESTADOS_CELULA)[number];

/**
 * Exercício vinculado a uma prova só existe para o aluno sorteado com aquela prova
 * (Fase 5). Sem esta regra, metade da matriz apareceria como "não iniciou" falso —
 * o aluno nunca viu aquele exercício (Fase 9, D3).
 */
export function exercicioVisivelParaAluno(
  exercicioProvaId: string | null,
  matriculaProvaId: string | null | undefined,
): boolean {
  return exercicioProvaId === null || exercicioProvaId === matriculaProvaId;
}

/**
 * Tem parte que só humano corrige. Exercício público fica de fora: a correção dele é
 * automática por definição (Fase 8, D6), e incluí-lo encheria a fila do professor de
 * trabalho que ninguém deve fazer (Fase 9, D4).
 */
export function temCorrecaoManual(
  exercicio: Pick<Exercicio, 'publico' | 'mer_gabarito' | 'gabarito_dissertativo'>,
): boolean {
  return !exercicio.publico && (exercicio.mer_gabarito !== null || exercicio.gabarito_dissertativo !== null);
}

export function aguardaRevisao(
  exercicio: Pick<Exercicio, 'publico' | 'mer_gabarito' | 'gabarito_dissertativo'>,
  resultado: Pick<ResultadoExercicio, 'finalizado_em' | 'revisado'> | null,
): boolean {
  return resultado?.finalizado_em != null && !resultado.revisado && temCorrecaoManual(exercicio);
}

/**
 * Estado de um par aluno × exercício. A ordem das perguntas é a precedência: "aguardando
 * revisão" vem antes de "correto" porque um exercício pode ter o SQL certo e a modelagem
 * ainda por corrigir — e o que importa nos dois painéis é que falta alguém agir.
 */
export function estadoDaCelula(
  exercicio: Pick<Exercicio, 'publico' | 'mer_gabarito' | 'gabarito_dissertativo'>,
  resultado: Pick<ResultadoExercicio, 'finalizado_em' | 'revisado' | 'sql_correto'> | null,
  temAtividade: boolean,
): EstadoCelula {
  if (aguardaRevisao(exercicio, resultado)) {
    return 'aguardando_revisao';
  }

  if (resultado?.sql_correto === true) {
    return 'correto';
  }

  if (resultado?.finalizado_em != null) {
    return 'entregue';
  }

  return temAtividade ? 'em_andamento' : 'nao_iniciou';
}
