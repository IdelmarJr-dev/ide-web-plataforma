import { Client } from 'pg';
import { config } from '../config';
import { SandboxIndisponivelError } from '../errors';
import { logger } from '../utils/logger';

// Uma conexão nova por chamada, nunca um Pool compartilhado — evita vazar
// search_path/statement_timeout de sessão entre requests reaproveitados (ver
// docs/decisions/fase2-sandbox-sql-diagrama-mer.md). Volume de uma turma de TCC
// não justifica a complexidade extra de pooling com reset garantido.

export function criarClienteProvisionamento(): Client {
  return new Client({ connectionString: config.sandbox.databaseUrl });
}

export function criarClienteExecucao(): Client {
  return new Client({ connectionString: config.sandbox.execDatabaseUrl });
}

/**
 * `client.connect()` falhando (host errado, credencial errada, banco fora do ar) não é um
 * erro de SQL do aluno — sem isto, a exceção crua do driver `pg` escapava direto pro
 * handler genérico e virava "erro inesperado" em vez de uma mensagem clara.
 */
export async function conectar(client: Client): Promise<void> {
  try {
    await client.connect();
  } catch (error) {
    // AppError não loga o motivo real pro handler genérico — sem isto, a causa (host
    // errado, credencial errada, banco fora do ar) some dos logs do Render.
    logger.error('Falha ao conectar no banco do sandbox', {
      message: error instanceof Error ? error.message : String(error),
    });
    throw new SandboxIndisponivelError();
  }
}
