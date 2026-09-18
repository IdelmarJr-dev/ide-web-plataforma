import { z } from 'zod';
import type { Turma, Usuario } from '../generated/prisma/client';

export const TURNOS = ['manha', 'tarde', 'noite'] as const;

export const criarTurmaBodySchema = z.object({
  nome: z.string().min(1),
  disciplina: z.string().min(1).optional(),
  semestre: z.string().min(1),
  // Só servem pro filtro do painel; turma sem eles continua válida (Fase 10, D14).
  turno: z.enum(TURNOS).optional(),
  sala: z.string().min(1).optional(),
});

export type CriarTurmaBodyDto = z.infer<typeof criarTurmaBodySchema>;

export const turmaResponseSchema = z.object({
  id: z.string(),
  nome: z.string(),
  disciplina: z.string(),
  semestre: z.string(),
  turno: z.enum(TURNOS).nullable(),
  sala: z.string().nullable(),
  professorId: z.string(),
  codigo: z.string(),
  encerradaEm: z.string().nullable(),
  criadoEm: z.string(),
});

export type TurmaResponseDto = z.infer<typeof turmaResponseSchema>;

export function toTurmaResponseDto(turma: Turma): TurmaResponseDto {
  return {
    id: turma.id,
    nome: turma.nome,
    disciplina: turma.disciplina,
    semestre: turma.semestre,
    turno: turma.turno,
    sala: turma.sala,
    professorId: turma.professor_id,
    codigo: turma.codigo,
    encerradaEm: turma.encerrada_em?.toISOString() ?? null,
    criadoEm: turma.criado_em.toISOString(),
  };
}

export const alunoResponseSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string().nullable(),
  matricula: z.string().nullable(),
});

export type AlunoResponseDto = z.infer<typeof alunoResponseSchema>;

export function toAlunoResponseDto(usuario: Usuario): AlunoResponseDto {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    matricula: usuario.matricula,
  };
}
