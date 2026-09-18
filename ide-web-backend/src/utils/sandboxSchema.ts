import { ValidationError } from '../errors';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * exercicioId/usuarioId viram identificador de schema numa DDL bruta (não dá pra
 * parametrizar nome de schema no protocolo do Postgres) — validar formato UUID
 * antes é obrigatório, não defensivo.
 */
export function nomeSchemaSandbox(exercicioId: string, usuarioId: string): string {
  if (!UUID_REGEX.test(exercicioId) || !UUID_REGEX.test(usuarioId)) {
    throw new ValidationError('Identificador de exercício ou usuário inválido');
  }

  return `sandbox_${exercicioId.replaceAll('-', '_')}_${usuarioId.replaceAll('-', '_')}`;
}

/** Banco de estudo livre do aluno, sem exercício — ver Fase 8. */
export function nomeSchemaSandboxLivre(usuarioId: string): string {
  if (!UUID_REGEX.test(usuarioId)) {
    throw new ValidationError('Identificador de usuário inválido');
  }

  return `sandbox_livre_${usuarioId.replaceAll('-', '_')}`;
}

/**
 * Role de execução do sandbox SQL, uma por aluno (Fase 12, D13) — substitui a role
 * `sandbox_exec` única e global. Motivo: `sandbox_exec` era compartilhada por todos os
 * alunos e acumulava GRANT de todo schema já provisionado; como `pg_namespace` é
 * catálogo público (nome de schema de outro aluno é descobrível), isso permitia, em
 * tese, alcançar schema alheio com um `SELECT` qualificado. Uma role por aluno, com
 * grant só no próprio schema, fecha essa lacuna estruturalmente.
 *
 * Mesma validação de UUID de `nomeSchemaSandbox*`: o nome vira identificador de role
 * numa DDL bruta (não dá pra parametrizar nome de role no protocolo do Postgres).
 */
export function nomeRoleExecucao(usuarioId: string): string {
  if (!UUID_REGEX.test(usuarioId)) {
    throw new ValidationError('Identificador de usuário inválido');
  }

  return `exec_${usuarioId.replaceAll('-', '_')}`;
}
