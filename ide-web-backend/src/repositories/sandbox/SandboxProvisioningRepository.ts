import { criarClienteProvisionamento } from '../../lib/sandboxDb';
import { nomeRoleExecucao } from '../../utils/sandboxSchema';
import type { Client } from 'pg';

// Role de login mínima, sem privilégio próprio — só serve pra autenticar a conexão de
// execução, que logo em seguida assume a identidade do aluno com SET ROLE (Fase 12,
// D14). Nunca recebe GRANT de schema nenhum diretamente; só é membro das roles
// exec_<usuario_id> que ela mesma foi tornada membro no provisionamento de cada aluno.
const SANDBOX_LOGIN_ROLE = 'sandbox_login';

export interface SandboxProvisioningRepository {
  garantirSchema(schemaName: string, usuarioId: string, sqlSetup: string | null): Promise<void>;
  garantirSchemaLivre(schemaName: string, usuarioId: string): Promise<void>;
  dropSchema(schemaName: string): Promise<void>;
}

export class PgSandboxProvisioningRepository implements SandboxProvisioningRepository {
  async garantirSchema(schemaName: string, usuarioId: string, sqlSetup: string | null): Promise<void> {
    const client = criarClienteProvisionamento();
    await client.connect();

    try {
      const roleExecucao = await this.garantirRoleExecucao(client, usuarioId);

      const existe = await client.query('SELECT 1 FROM information_schema.schemata WHERE schema_name = $1', [
        schemaName,
      ]);

      if (!existe.rowCount || existe.rowCount === 0) {
        await client.query(`CREATE SCHEMA "${schemaName}"`);

        if (sqlSetup && sqlSetup.trim() !== '') {
          // sql_setup é redigido pelo professor (não é entrada do aluno) — texto de
          // setup legitimamente multi-statement (CREATE TABLE + INSERT), protocolo
          // simples é o correto aqui, diferente da query do aluno em SandboxExecutionRepository.
          await client.query(`SET search_path TO "${schemaName}"`);
          await client.query(sqlSetup);
        }
      }

      // GRANT roda sempre, schema novo ou não — idempotente no Postgres (reconceder
      // privilégio já concedido é no-op) e é o que corrige, sem precisar de migração
      // separada, um schema que já existia antes da role de execução virar por-aluno
      // (Fase 12, D13): sem isso, um `return` antecipado no ramo "já existe" deixaria
      // a role recém-criada sem nenhum grant sobre o schema que ela deveria acessar.
      await client.query(`GRANT USAGE ON SCHEMA "${schemaName}" TO "${roleExecucao}"`);
      await client.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "${schemaName}" TO "${roleExecucao}"`,
      );
    } finally {
      await client.end();
    }
  }

  /**
   * Banco de estudo livre: sem `sql_setup` de professor, não existe tabela nenhuma pra
   * consultar — por isso aqui, e só aqui, o aluno ganha CREATE e monta o próprio
   * esquema (inclusive rodando o DDL que o modelo lógico dele gera). Ver
   * docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md.
   */
  async garantirSchemaLivre(schemaName: string, usuarioId: string): Promise<void> {
    const client = criarClienteProvisionamento();
    await client.connect();

    try {
      const roleExecucao = await this.garantirRoleExecucao(client, usuarioId);

      const existe = await client.query('SELECT 1 FROM information_schema.schemata WHERE schema_name = $1', [
        schemaName,
      ]);

      if (!existe.rowCount || existe.rowCount === 0) {
        await client.query(`CREATE SCHEMA "${schemaName}"`);
      }

      // Sempre reconcede — mesmo raciocínio de garantirSchema acima (Fase 12, D13).
      await client.query(`GRANT USAGE, CREATE ON SCHEMA "${schemaName}" TO "${roleExecucao}"`);
    } finally {
      await client.end();
    }
  }

  /**
   * Cria, se ainda não existir, a role de execução exclusiva do aluno e torna
   * `sandbox_login` membro dela — é essa associação que permite à conexão de execução
   * (que sempre autentica como `sandbox_login`) fazer `SET ROLE` pra essa identidade
   * depois. Sem privilégio de superusuário/CREATEDB/CREATEROLE/LOGIN próprio: a role
   * só existe pra segurar os GRANTs de schema do próprio aluno (Fase 12, D13).
   */
  private async garantirRoleExecucao(client: Client, usuarioId: string): Promise<string> {
    const roleExecucao = nomeRoleExecucao(usuarioId);

    const existe = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [roleExecucao]);
    if (existe.rowCount && existe.rowCount > 0) {
      return roleExecucao;
    }

    await client.query(`CREATE ROLE "${roleExecucao}" NOSUPERUSER NOCREATEDB NOCREATEROLE NOLOGIN`);
    await client.query(`GRANT "${roleExecucao}" TO ${SANDBOX_LOGIN_ROLE}`);

    return roleExecucao;
  }

  async dropSchema(schemaName: string): Promise<void> {
    const client = criarClienteProvisionamento();
    await client.connect();

    try {
      await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    } finally {
      await client.end();
    }
  }
}
