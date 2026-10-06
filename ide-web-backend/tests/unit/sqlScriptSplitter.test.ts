import { describe, expect, it } from 'vitest';
import { dividirScript, ScriptSqlInvalidoError } from '../../src/utils/sandboxScript/sqlScriptSplitter';

describe('dividirScript', () => {
  it('devolve lista vazia pra script vazio ou só espaço em branco', async () => {
    expect(await dividirScript('')).toEqual([]);
    expect(await dividirScript('   \n  ')).toEqual([]);
  });

  it('divide um script com várias instruções simples', async () => {
    const instrucoes = await dividirScript('SELECT 1; SELECT 2');

    expect(instrucoes).toHaveLength(2);
    expect(instrucoes[0]?.sql).toBe('SELECT 1');
    expect(instrucoes[1]?.sql).toBe('SELECT 2');
    expect(Object.keys(instrucoes[0]?.stmt ?? {})).toEqual(['SelectStmt']);
  });

  it('não quebra em ";" dentro de comentário de linha', async () => {
    const instrucoes = await dividirScript(`-- comentario com ; dentro\nSELECT 1; -- outro ; comentario\nSELECT 2`);

    expect(instrucoes).toHaveLength(2);
    expect(instrucoes[0]?.sql).toBe('SELECT 1');
    expect(instrucoes[1]?.sql).toBe('SELECT 2');
  });

  it('não quebra em ";" dentro de dólar-quoting ($$...$$)', async () => {
    const script = [
      'CREATE FUNCTION foo() RETURNS int AS $$',
      'BEGIN',
      "  RETURN 1; -- ; dentro do dolar-quote",
      'END;',
      '$$ LANGUAGE plpgsql;',
      'SELECT 2',
    ].join('\n');

    const instrucoes = await dividirScript(script);

    expect(instrucoes).toHaveLength(2);
    expect(Object.keys(instrucoes[0]?.stmt ?? {})).toEqual(['CreateFunctionStmt']);
    expect(instrucoes[0]?.sql).toContain('RETURN 1');
    expect(instrucoes[1]?.sql).toBe('SELECT 2');
  });

  it('não quebra em ";" dentro de string literal', async () => {
    const instrucoes = await dividirScript(`INSERT INTO t (a) VALUES ('texto; com ponto e virgula')`);

    expect(instrucoes).toHaveLength(1);
    expect(instrucoes[0]?.sql).toContain('texto; com ponto e virgula');
  });

  it('a última instrução sem ";" final é incluída por completo', async () => {
    const instrucoes = await dividirScript('SELECT 1;\nSELECT 2');

    expect(instrucoes).toHaveLength(2);
    expect(instrucoes[1]?.sql).toBe('SELECT 2');
  });

  it('rejeita script com erro de sintaxe', async () => {
    await expect(dividirScript('SELECT 1; GARBAGE HERE')).rejects.toThrow(ScriptSqlInvalidoError);
  });
});
