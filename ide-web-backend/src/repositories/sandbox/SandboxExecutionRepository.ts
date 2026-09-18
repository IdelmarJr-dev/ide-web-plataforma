import { conectar, criarClienteExecucao } from '../../lib/sandboxDb';
import { nomeRoleExecucao } from '../../utils/sandboxSchema';

export interface SandboxExecucaoSucesso {
  status: 'sucesso';
  rows: Record<string, unknown>[];
}

export interface SandboxExecucaoErro {
  status: 'erro_sintaxe' | 'erro_execucao';
  message: string;
}

export type SandboxExecucaoResultado = SandboxExecucaoSucesso | SandboxExecucaoErro;

const CODIGO_ERRO_SINTAXE_PREFIXO = '42';

function classificarErro(error: unknown): SandboxExecucaoErro {
  const codigo = error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
  const message = error instanceof Error ? error.message : 'Erro ao executar a consulta';
  const status = codigo?.startsWith(CODIGO_ERRO_SINTAXE_PREFIXO) ? 'erro_sintaxe' : 'erro_execucao';
  return { status, message };
}

export interface SandboxExecutionRepository {
  executar(schemaName: string, usuarioId: string, sql: string, timeoutMs: number): Promise<SandboxExecucaoResultado>;
  explain(schemaName: string, usuarioId: string, sql: string, timeoutMs: number): Promise<unknown>;
}

export class PgSandboxExecutionRepository implements SandboxExecutionRepository {
  async executar(
    schemaName: string,
    usuarioId: string,
    sql: string,
    timeoutMs: number,
  ): Promise<SandboxExecucaoResultado> {
    const client = criarClienteExecucao();
    await conectar(client);

    try {
      // A conexão autentica como sandbox_login (sem privilégio próprio) e assume aqui
      // a identidade real de execução do aluno — uma role por aluno, não mais uma
      // sandbox_exec global e compartilhada (Fase 12, D13/D14). SET ROLE só funciona
      // porque sandbox_login foi tornada membro de exec_<usuario_id> no provisionamento.
      await client.query(`SET ROLE "${nomeRoleExecucao(usuarioId)}"`);
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(`SET statement_timeout = ${String(timeoutMs)}`);
      // `values: []` força o protocolo estendido do pg — o wire protocol do Postgres
      // restringe o protocolo estendido a um único statement, o que impede
      // "SELECT 1; DROP TABLE x" num request só. Nunca trocar por client.query(sql).
      const resultado = await client.query({ text: sql, values: [] });
      return { status: 'sucesso', rows: resultado.rows as Record<string, unknown>[] };
    } catch (error) {
      return classificarErro(error);
    } finally {
      await client.end();
    }
  }

  /**
   * Só pode ser chamado com um `sql` que já passou por `executar` com sucesso —
   * isso é o que garante que o texto é um único statement (o protocolo estendido
   * usado em `executar` já teria rejeitado múltiplos). EXPLAIN não aceita
   * parâmetros, então roda via protocolo simples sobre texto já validado.
   */
  async explain(schemaName: string, usuarioId: string, sql: string, timeoutMs: number): Promise<unknown> {
    const client = criarClienteExecucao();
    await conectar(client);

    try {
      await client.query(`SET ROLE "${nomeRoleExecucao(usuarioId)}"`);
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(`SET statement_timeout = ${String(timeoutMs)}`);
      const resultado = await client.query(`EXPLAIN (FORMAT JSON) ${sql}`);
      return (resultado.rows[0] as Record<string, unknown> | undefined)?.['QUERY PLAN'] ?? null;
    } finally {
      await client.end();
    }
  }
}
