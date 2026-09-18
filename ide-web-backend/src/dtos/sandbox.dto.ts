import { z } from 'zod';

export const testarSandboxBodySchema = z.object({
  sql: z.string().min(1),
});

export type TestarSandboxBodyDto = z.infer<typeof testarSandboxBodySchema>;

export const enviarSandboxBodySchema = z.object({
  sql: z.string().min(1),
});

export type EnviarSandboxBodyDto = z.infer<typeof enviarSandboxBodySchema>;

export interface TestarSandboxResponseDto {
  status: 'sucesso' | 'erro_sintaxe' | 'erro_execucao';
  rows?: Record<string, unknown>[];
  message?: string;
}

export interface EnviarSandboxResponseDto extends TestarSandboxResponseDto {
  correta: boolean | null;
  submissaoId: string;
  tentativaNumero: number;
  // Plano de execução (EXPLAIN FORMAT JSON) da query do aluno — só quando executou com sucesso.
  plano: unknown;
}
