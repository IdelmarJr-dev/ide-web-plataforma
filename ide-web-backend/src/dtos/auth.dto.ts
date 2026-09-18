import { z } from 'zod';
import type { Usuario } from '../generated/prisma/client';

const MIN_PASSWORD_LENGTH = 8;

// Todo papel se registra com e-mail e senha — a sessão leve do aluno (nome + código
// da turma) saiu na Fase 8, ver docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md.
// `pesquisador` NÃO é registrável por aqui: é conta única do autor, criada por
// scripts/seed-pesquisador.ts — ver docs/decisions/fase12-sql-studio-bd2.md e a
// Restrição não-negociável do CLAUDE.md sobre o papel ser exclusivo do período de
// pesquisa. `usuarioResponseSchema.papel` abaixo continua aceitando o valor (é quem já
// existe fazendo login), só o registro público é que fecha essa porta.
export const registrarBodySchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  senha: z.string().min(MIN_PASSWORD_LENGTH),
  papel: z.enum(['aluno', 'professor']),
});

export type RegistrarBodyDto = z.infer<typeof registrarBodySchema>;

export const loginBodySchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

export type LoginBodyDto = z.infer<typeof loginBodySchema>;

export const usuarioResponseSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string().nullable(),
  papel: z.enum(['aluno', 'professor', 'pesquisador']),
});

export type UsuarioResponseDto = z.infer<typeof usuarioResponseSchema>;

export function toUsuarioResponseDto(usuario: Usuario): UsuarioResponseDto {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: usuario.papel,
  };
}
