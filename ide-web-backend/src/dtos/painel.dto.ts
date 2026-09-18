import { z } from 'zod';
import {
  exercicioBaseResponseSchema,
  exercicioProfessorResponseSchema,
  toExercicioAlunoResponseDto,
  toExercicioProfessorResponseDto,
} from './exercicio.dto';
import { toTurmaResponseDto, turmaResponseSchema } from './turma.dto';
import type { AtividadesDoAluno, PainelAluno, PainelProfessor, PainelTurma } from '../services/PainelService';
import { ESTADOS_CELULA } from '../utils/painel';

const estadoCelulaSchema = z.enum(ESTADOS_CELULA);

export const painelProfessorResponseSchema = z.object({
  resumo: z.object({
    turmasAtivas: z.number(),
    turmasEncerradas: z.number(),
    alunos: z.number(),
    exercicios: z.number(),
    aguardandoRevisao: z.number(),
  }),
  turmas: z.array(
    turmaResponseSchema.extend({
      alunos: z.number(),
      exercicios: z.number(),
      entregas: z.number(),
      aguardandoRevisao: z.number(),
      ultimaAtividadeEm: z.string().nullable(),
    }),
  ),
});

export type PainelProfessorResponseDto = z.infer<typeof painelProfessorResponseSchema>;

export function toPainelProfessorResponseDto(painel: PainelProfessor): PainelProfessorResponseDto {
  return {
    resumo: painel.resumo,
    turmas: painel.turmas.map((item) => ({
      ...toTurmaResponseDto(item.turma),
      alunos: item.alunos,
      exercicios: item.exercicios,
      entregas: item.entregas,
      aguardandoRevisao: item.aguardandoRevisao,
      ultimaAtividadeEm: item.ultimaAtividadeEm?.toISOString() ?? null,
    })),
  };
}

export const painelTurmaResponseSchema = z.object({
  turma: turmaResponseSchema,
  // Visão do professor: com gabaritos, como em /turmas/:id/exercicios.
  exercicios: z.array(exercicioProfessorResponseSchema),
  alunos: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      email: z.string().nullable(),
      provaId: z.string().nullable(),
    }),
  ),
  celulas: z.array(
    z.object({
      alunoId: z.string(),
      exercicioId: z.string(),
      estado: estadoCelulaSchema,
      tentativas: z.number(),
      dicas: z.number(),
      finalizadoEm: z.string().nullable(),
      pontuacao: z.number().nullable(),
      ultimoEnvioComErro: z.boolean(),
    }),
  ),
  dificuldade: z.array(
    z.object({
      exercicioId: z.string(),
      taxaAcerto: z.number().nullable(),
      mediaTentativas: z.number().nullable(),
      dicasPorAluno: z.number(),
    }),
  ),
});

export type PainelTurmaResponseDto = z.infer<typeof painelTurmaResponseSchema>;

export function toPainelTurmaResponseDto(painel: PainelTurma): PainelTurmaResponseDto {
  return {
    turma: toTurmaResponseDto(painel.turma),
    exercicios: painel.exercicios.map(toExercicioProfessorResponseDto),
    alunos: painel.alunos.map((aluno) => ({
      id: aluno.id,
      nome: aluno.nome,
      email: aluno.email,
      provaId: aluno.provaId,
    })),
    celulas: painel.celulas.map((celula) => ({
      alunoId: celula.alunoId,
      exercicioId: celula.exercicioId,
      estado: celula.estado,
      tentativas: celula.tentativas,
      dicas: celula.dicas,
      finalizadoEm: celula.finalizadoEm?.toISOString() ?? null,
      pontuacao: celula.pontuacao,
      ultimoEnvioComErro: celula.ultimoEnvioComErro,
    })),
    dificuldade: painel.dificuldade,
  };
}

// Sem gabarito: é a visão do aluno.
const exercicioDoAlunoSchema = exercicioBaseResponseSchema.extend({
  estado: estadoCelulaSchema,
  turmaId: z.string(),
  turmaNome: z.string(),
  disciplina: z.string(),
  gabaritoLiberado: z.boolean(),
  finalizadoEm: z.string().nullable(),
});

type ExercicioDoAlunoDto = z.infer<typeof exercicioDoAlunoSchema>;

function toExercicioDoAlunoDto(item: PainelAluno['pendencias'][number]): ExercicioDoAlunoDto {
  return {
    ...toExercicioAlunoResponseDto(item.exercicio),
    estado: item.estado,
    turmaId: item.turmaId,
    turmaNome: item.turmaNome,
    disciplina: item.disciplina,
    gabaritoLiberado: item.gabaritoLiberado,
    finalizadoEm: item.finalizadoEm?.toISOString() ?? null,
  };
}

export const painelAlunoResponseSchema = z.object({
  resumo: z.object({
    turmas: z.number(),
    pendentes: z.number(),
    entregues: z.number(),
    acertos: z.number(),
  }),
  disciplinas: z.array(
    z.object({
      disciplina: z.string(),
      turmas: z.array(turmaResponseSchema.extend({ exercicios: z.array(exercicioDoAlunoSchema) })),
    }),
  ),
  pendencias: z.array(exercicioDoAlunoSchema),
  historico: z.array(exercicioDoAlunoSchema),
  progresso: z.object({
    porTurma: z.array(
      z.object({ turmaId: z.string(), turmaNome: z.string(), total: z.number(), entregues: z.number() }),
    ),
    tentativasAteAcertar: z.array(
      z.object({ exercicioId: z.string(), titulo: z.string(), tentativas: z.number() }),
    ),
  }),
});

export type PainelAlunoResponseDto = z.infer<typeof painelAlunoResponseSchema>;

export function toPainelAlunoResponseDto(painel: PainelAluno): PainelAlunoResponseDto {
  return {
    resumo: painel.resumo,
    disciplinas: painel.disciplinas.map((grupo) => ({
      disciplina: grupo.disciplina,
      turmas: grupo.turmas.map((item) => ({
        ...toTurmaResponseDto(item.turma),
        exercicios: item.exercicios.map(toExercicioDoAlunoDto),
      })),
    })),
    pendencias: painel.pendencias.map(toExercicioDoAlunoDto),
    historico: painel.historico.map(toExercicioDoAlunoDto),
    progresso: painel.progresso,
  };
}

// Fase 10, D4: a revisão passa a ser da pessoa, não de uma questão solta.
export const atividadesDoAlunoResponseSchema = z.object({
  aluno: z.object({ id: z.string(), nome: z.string(), email: z.string().nullable() }),
  turma: turmaResponseSchema,
  atividades: z.array(
    exercicioProfessorResponseSchema.extend({
      estado: estadoCelulaSchema,
      tentativas: z.number(),
      dicas: z.number(),
      finalizadoEm: z.string().nullable(),
      sqlCorreto: z.boolean().nullable(),
      merAvaliacao: z.number().nullable(),
      dissertativaAvaliacao: z.number().nullable(),
      pontuacao: z.number().nullable(),
      revisado: z.boolean(),
      envioLiberadoEm: z.string().nullable(),
      ultimoEnvioComErro: z.boolean(),
    }),
  ),
});

export type AtividadesDoAlunoResponseDto = z.infer<typeof atividadesDoAlunoResponseSchema>;

export function toAtividadesDoAlunoResponseDto(dados: AtividadesDoAluno): AtividadesDoAlunoResponseDto {
  return {
    aluno: { id: dados.aluno.id, nome: dados.aluno.nome, email: dados.aluno.email },
    turma: toTurmaResponseDto(dados.turma),
    atividades: dados.atividades.map((item) => ({
      ...toExercicioProfessorResponseDto(item.exercicio),
      estado: item.estado,
      tentativas: item.tentativas,
      dicas: item.dicas,
      finalizadoEm: item.finalizadoEm?.toISOString() ?? null,
      sqlCorreto: item.sqlCorreto,
      merAvaliacao: item.merAvaliacao,
      dissertativaAvaliacao: item.dissertativaAvaliacao,
      pontuacao: item.pontuacao,
      revisado: item.revisado,
      envioLiberadoEm: item.envioLiberadoEm?.toISOString() ?? null,
      ultimoEnvioComErro: item.ultimoEnvioComErro,
    })),
  };
}
