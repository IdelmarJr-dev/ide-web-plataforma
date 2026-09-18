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

interface ErroPostgres extends Error {
  code?: string;
  table?: string;
  column?: string;
  constraint?: string;
}

// node-postgres só preenche table/column/constraint pra alguns códigos (violação de
// restrição); nos demais (sintaxe, relação/coluna inexistente) o identificador só
// aparece entre aspas dentro da mensagem em inglês do próprio Postgres.
const REGEX_IDENTIFICADOR = /"([^"]+)"/g;

function extrairIdentificadores(mensagem: string): string[] {
  return [...mensagem.matchAll(REGEX_IDENTIFICADOR)]
    .map((correspondencia) => correspondencia[1])
    .filter((valor): valor is string => valor !== undefined);
}

function quotar(valor?: string): string {
  return valor ? `"${valor}"` : 'informada';
}

// Mensagens do driver `pg` vêm em inglês (idioma do servidor Postgres) — como isso é
// visível direto pro aluno no editor de SQL, traduzimos os erros mais comuns de quem
// está aprendendo, por código SQLSTATE. O que não está no mapa cai num texto genérico
// em português (nunca a mensagem crua em inglês).
const TRADUCOES_POR_CODIGO: Record<string, (erro: ErroPostgres) => string> = {
  '42601': (erro) => {
    const [proximo] = extrairIdentificadores(erro.message);
    return `Erro de sintaxe na consulta${proximo ? ` perto de "${proximo}"` : ''}.`;
  },
  '42P01': (erro) => `A tabela ${quotar(extrairIdentificadores(erro.message)[0])} não existe.`,
  '42703': (erro) => `A coluna ${quotar(erro.column ?? extrairIdentificadores(erro.message)[0])} não existe.`,
  '42702': (erro) => `A coluna ${quotar(extrairIdentificadores(erro.message)[0])} é ambígua — especifique de qual tabela ela vem.`,
  '42883': (erro) => `A função ${quotar(extrairIdentificadores(erro.message)[0])} não existe (confira o nome e os tipos dos argumentos).`,
  '42P07': (erro) => `A tabela ${quotar(extrairIdentificadores(erro.message)[0])} já existe.`,
  '42710': (erro) => `${quotar(extrairIdentificadores(erro.message)[0])} já existe.`,
  '23505': (erro) =>
    `Valor duplicado: já existe um registro com esse valor${erro.constraint ? ` (restrição "${erro.constraint}")` : ''}.`,
  '23503': (erro) =>
    `Essa operação viola uma chave estrangeira${erro.table ? ` na tabela "${erro.table}"` : ''} — verifique se o registro relacionado existe.`,
  '23502': (erro) => `A coluna ${quotar(erro.column)} não pode receber valor nulo.`,
  '23514': (erro) =>
    `O valor informado viola a restrição de verificação (CHECK)${erro.constraint ? ` "${erro.constraint}"` : ''}.`,
  '22012': () => 'Divisão por zero.',
  '22P02': (erro) => {
    const valor = extrairIdentificadores(erro.message).at(-1);
    return `Valor inválido para o tipo esperado${valor ? `: "${valor}"` : ''}.`;
  },
  '22003': () => 'Valor numérico fora do intervalo permitido para o tipo da coluna.',
  '42501': () => 'Privilégio insuficiente para executar essa operação.',
  '25P02': () => 'A transação atual falhou — a consulta anterior teve erro e precisa ser refeita desde o início.',
};

function traduzirMensagem(error: unknown, codigo: string | undefined): string {
  if (!(error instanceof Error)) {
    return 'Erro ao executar a consulta.';
  }
  const tradutor = codigo ? TRADUCOES_POR_CODIGO[codigo] : undefined;
  if (tradutor) {
    return tradutor(error);
  }
  return codigo ? `Erro ao executar a consulta (código ${codigo}).` : 'Erro ao executar a consulta.';
}

export function classificarErro(error: unknown): SandboxExecucaoErro {
  const codigo = error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
  const status = codigo?.startsWith(CODIGO_ERRO_SINTAXE_PREFIXO) ? 'erro_sintaxe' : 'erro_execucao';
  return { status, message: traduzirMensagem(error, codigo) };
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
