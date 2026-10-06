import { parse } from 'libpg-query';
import type { Node, RawStmt } from 'libpg-query';

export interface InstrucaoDividida {
  /** Texto exato da instrução, sem o `;` terminador — pronto pra `client.query`. */
  sql: string;
  /** AST da instrução, pra `classificarInstrucao` decidir a rota de execução. */
  stmt: Node;
}

export class ScriptSqlInvalidoError extends Error {}

/**
 * Divide um script multi-statement em instruções individuais usando o parser real do
 * Postgres (`libpg-query`) — nunca `split(';')` por texto, que quebra em dólar-quoting
 * (`$$...$$`), comentário com `;` dentro e string literal com `;` dentro (ver skill
 * sql-sandbox-security, item 1). `parse()` já devolve o AST de cada instrução com a
 * posição exata no texto original (`stmt_location`/`stmt_len`), então a "divisão" é só
 * recortar essas posições — não precisa de um scanner/lexer separado.
 *
 * Escopo conhecido: um erro de sintaxe em qualquer instrução do script impede dividir
 * (e portanto executar) o script inteiro, mesmo que instruções anteriores seriam
 * sintaticamente válidas isoladas — `parse()` roda sobre o texto completo de uma vez.
 * Isso é diferente de um erro de *execução* no meio do script (ver Suposição 2 do
 * decision doc), que para no primeiro erro mas mantém o que já rodou.
 */
export async function dividirScript(script: string): Promise<InstrucaoDividida[]> {
  if (script.trim() === '') {
    return [];
  }

  let resultado;
  try {
    resultado = await parse(script);
  } catch (error) {
    throw new ScriptSqlInvalidoError(error instanceof Error ? error.message : 'Erro de sintaxe no script SQL.');
  }

  return (resultado.stmts ?? [])
    .filter((raw): raw is RawStmt & { stmt: Node } => raw.stmt !== undefined)
    .map((raw) => {
      const inicio = raw.stmt_location ?? 0;
      // stmt_len vem 0 (omitido na serialização) na última instrução do script —
      // convenção do parser pra "até o fim do texto", nunca uma instrução de fato vazia.
      const fim = raw.stmt_len ? inicio + raw.stmt_len : script.length;
      return { sql: script.slice(inicio, fim).trim(), stmt: raw.stmt };
    });
}
