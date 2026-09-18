import { z } from 'zod'

export const TURNOS = ['manha', 'tarde', 'noite'] as const
export type Turno = (typeof TURNOS)[number]

export const ROTULO_TURNO: Record<Turno, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
}

export interface Turma {
  id: string
  nome: string
  disciplina: string
  semestre: string
  turno: Turno | null
  sala: string | null
  professorId: string
  codigo: string
  encerradaEm: string | null
  criadoEm: string
}

export interface Aluno {
  id: string
  nome: string
  email: string | null
  matricula: string | null
}

export const criarTurmaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da turma.'),
  disciplina: z.string().trim().min(1, 'Informe a disciplina.').optional(),
  semestre: z.string().trim().min(1, 'Informe o semestre.'),
  // Opcionais: só alimentam o filtro do painel (Fase 10, D14).
  turno: z.enum(TURNOS).optional(),
  sala: z.string().trim().min(1).optional(),
})
export type CriarTurmaInput = z.infer<typeof criarTurmaSchema>

// O código da turma é matrícula, não credencial: o aluno já chega logado e usa o
// código uma vez só (docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md).
export const matricularSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(1, 'Informe o código da turma.')
    .transform((value) => value.toUpperCase()),
})
export type MatricularInput = z.infer<typeof matricularSchema>
