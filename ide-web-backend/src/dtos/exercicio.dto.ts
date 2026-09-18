import { z } from 'zod';
import type { Exercicio } from '../generated/prisma/client';
import { documentoModelagemSchema, MODOS_EXERCICIO } from './modelagem.schema';

export const criarExercicioBodySchema = z.object({
  turmaId: z.string().uuid(),
  // Ausente/null = exercício "solto", visível pra turma inteira. Presente = só
  // visível pro aluno sorteado com essa prova (ver docs/decisions/fase5-sorteador-provas.md).
  provaId: z.string().uuid().nullable().optional(),
  titulo: z.string().min(1),
  enunciado: z.string().min(1),
  nivelDificuldade: z.enum(['iniciante', 'intermediario']),
  ordem: z.number().int().nonnegative().optional(),
  // Nulo/ausente = sem prazo (Fase 10, D7).
  prazo: z.coerce.date().optional(),
  // Público = qualquer aluno logado resolve, sem matrícula na turma de origem
  // (docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md).
  publico: z.boolean().optional(),
  merGabarito: documentoModelagemSchema.optional(),
  // Nível da modelagem (docs/decisions/fase7-modelagem-conceitual-logica.md).
  modoMer: z.enum(MODOS_EXERCICIO).optional(),
  sqlGabarito: z.string().min(1).optional(),
  sqlSetup: z.string().min(1).optional(),
  gabaritoDissertativo: z.string().min(1).optional(),
});

export type CriarExercicioBodyDto = z.infer<typeof criarExercicioBodySchema>;

export const atualizarExercicioBodySchema = z.object({
  titulo: z.string().min(1).optional(),
  provaId: z.string().uuid().nullable().optional(),
  enunciado: z.string().min(1).optional(),
  nivelDificuldade: z.enum(['iniciante', 'intermediario']).optional(),
  ordem: z.number().int().nonnegative().optional(),
  prazo: z.coerce.date().nullable().optional(),
  publico: z.boolean().optional(),
  merGabarito: documentoModelagemSchema.optional(),
  // Nível da modelagem (docs/decisions/fase7-modelagem-conceitual-logica.md).
  modoMer: z.enum(MODOS_EXERCICIO).optional(),
  sqlGabarito: z.string().min(1).optional(),
  sqlSetup: z.string().min(1).optional(),
  gabaritoDissertativo: z.string().min(1).optional(),
});

export type AtualizarExercicioBodyDto = z.infer<typeof atualizarExercicioBodySchema>;

export const exercicioBaseResponseSchema = z.object({
  id: z.string(),
  turmaId: z.string(),
  provaId: z.string().nullable(),
  titulo: z.string(),
  enunciado: z.string(),
  nivelDificuldade: z.enum(['iniciante', 'intermediario']),
  ordem: z.number(),
  prazo: z.string().nullable(),
  publico: z.boolean(),
  gabaritoLiberado: z.boolean(),
  temSql: z.boolean(),
  temMer: z.boolean(),
  temDissertativa: z.boolean(),
  modoMer: z.enum(MODOS_EXERCICIO),
  // Script de dados-exemplo (não é resposta): o grupo controle da pesquisa carrega no
  // pgAdmin pra trabalhar com os mesmos dados do sandbox.
  sqlSetup: z.string().nullable(),
  criadoEm: z.string(),
});

export const exercicioProfessorResponseSchema = exercicioBaseResponseSchema.extend({
  merGabarito: z.unknown().nullable(),
  sqlGabarito: z.string().nullable(),
  gabaritoDissertativo: z.string().nullable(),
});

export type ExercicioProfessorResponseDto = z.infer<typeof exercicioProfessorResponseSchema>;

export type ExercicioAlunoResponseDto = z.infer<typeof exercicioBaseResponseSchema>;

function toExercicioBaseResponseDto(exercicio: Exercicio): ExercicioAlunoResponseDto {
  return {
    id: exercicio.id,
    turmaId: exercicio.turma_id,
    provaId: exercicio.prova_id,
    titulo: exercicio.titulo,
    enunciado: exercicio.enunciado,
    nivelDificuldade: exercicio.nivel_dificuldade,
    ordem: exercicio.ordem,
    prazo: exercicio.prazo?.toISOString() ?? null,
    publico: exercicio.publico,
    gabaritoLiberado: exercicio.gabarito_liberado,
    temSql: exercicio.sql_gabarito !== null,
    temMer: exercicio.mer_gabarito !== null,
    temDissertativa: exercicio.gabarito_dissertativo !== null,
    modoMer: exercicio.modo_mer,
    sqlSetup: exercicio.sql_setup,
    criadoEm: exercicio.criado_em.toISOString(),
  };
}

export function toExercicioAlunoResponseDto(exercicio: Exercicio): ExercicioAlunoResponseDto {
  return toExercicioBaseResponseDto(exercicio);
}

export function toExercicioProfessorResponseDto(exercicio: Exercicio): ExercicioProfessorResponseDto {
  return {
    ...toExercicioBaseResponseDto(exercicio),
    merGabarito: exercicio.mer_gabarito,
    sqlGabarito: exercicio.sql_gabarito,
    gabaritoDissertativo: exercicio.gabarito_dissertativo,
  };
}
