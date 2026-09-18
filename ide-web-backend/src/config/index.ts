import 'dotenv/config';
import type { Env } from './env.schema';
import { envSchema } from './env.schema';

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }

  return parsed.data;
}

const env = loadEnv();

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  server: {
    port: env.PORT,
  },
  logLevel: env.LOG_LEVEL,
  cors: {
    origin: env.CORS_ORIGIN,
  },
  database: {
    url: env.DATABASE_URL,
  },
  jwt: {
    secret: env.JWT_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  researchJwt: {
    secret: env.RESEARCH_JWT_SECRET,
    expiresIn: env.RESEARCH_JWT_EXPIRES_IN,
  },
  llm: {
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL,
  },
  sandbox: {
    databaseUrl: env.SANDBOX_DATABASE_URL,
    execDatabaseUrl: env.SANDBOX_EXEC_DATABASE_URL,
    statementTimeoutMs: env.SANDBOX_STATEMENT_TIMEOUT_MS,
  },
} as const;
