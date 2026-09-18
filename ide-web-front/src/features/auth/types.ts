import { z } from 'zod'

export const PAPEIS = ['aluno', 'professor', 'pesquisador'] as const
export type Papel = (typeof PAPEIS)[number]

// Todo papel tem conta própria desde a Fase 8: o aluno entra com e-mail e senha e só
// então usa o código da turma pra se matricular. `pesquisador` fica de fora do
// registro público: é conta única do autor, criada por
// ide-web-backend/scripts/seed-pesquisador.ts — nunca por autocadastro.
export const PAPEIS_REGISTRAVEIS = ['aluno', 'professor'] as const
export type PapelRegistravel = (typeof PAPEIS_REGISTRAVEIS)[number]

export interface Usuario {
  id: string
  nome: string
  email: string | null
  papel: Papel
}

const MIN_PASSWORD_LENGTH = 8

export const loginSchema = z.object({
  email: z.string().trim().pipe(z.email('Informe um e-mail válido.')),
  senha: z.string().min(1, 'Informe sua senha.'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const registroSchema = z.object({
  nome: z.string().trim().min(1, 'Informe seu nome.'),
  email: z.string().trim().pipe(z.email('Informe um e-mail válido.')),
  senha: z.string().min(MIN_PASSWORD_LENGTH, `A senha precisa ter pelo menos ${String(MIN_PASSWORD_LENGTH)} caracteres.`),
  papel: z.enum(PAPEIS_REGISTRAVEIS),
})

export type RegistroInput = z.infer<typeof registroSchema>
