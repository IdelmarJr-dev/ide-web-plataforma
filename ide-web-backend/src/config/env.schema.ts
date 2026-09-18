import { z } from 'zod';

const DEFAULT_PORT = 3000;
const DEFAULT_SANDBOX_STATEMENT_TIMEOUT_MS = 5000;

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  // Segredo compartilhado só com o backend Python de pesquisa (self-hosted, fora do
  // Render) — ver docs/decisions/fase4-pesquisa-python-sessao-aluno-login.md. Assina
  // o token curto que o front usa como Bearer nas chamadas diretas ao Python; nunca é
  // enviado ao navegador.
  RESEARCH_JWT_SECRET: z.string().min(1),
  RESEARCH_JWT_EXPIRES_IN: z.string().default('30m'),
  LLM_API_KEY: z.string().optional(),
  // Modelo Groq usado pra montar as dicas de IA (ver docs/decisions/fase3-dicas-ia.md).
  // Groq é o único provedor em escopo, por isso não há LLM_PROVIDER configurável ainda.
  LLM_MODEL: z.string().min(1).default('llama-3.1-8b-instant'),
  // Banco do sandbox SQL — projeto Supabase separado do banco principal (ver
  // docs/decisions/fase2-sandbox-sql-diagrama-mer.md). Duas connection strings para
  // duas roles Postgres distintas: uma de provisionamento (cria/derruba schema) e uma
  // de execução (roda a query do aluno, sem DDL nem acesso fora do próprio schema).
  SANDBOX_DATABASE_URL: z.string().min(1),
  SANDBOX_EXEC_DATABASE_URL: z.string().min(1),
  SANDBOX_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(DEFAULT_SANDBOX_STATEMENT_TIMEOUT_MS),
});

export type Env = z.infer<typeof envSchema>;
