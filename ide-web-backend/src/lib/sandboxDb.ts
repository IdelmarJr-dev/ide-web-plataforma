import { Client } from 'pg';
import { config } from '../config';

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
