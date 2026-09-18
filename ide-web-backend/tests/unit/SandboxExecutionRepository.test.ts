import { describe, expect, it } from 'vitest';
import { classificarErro } from '../../src/repositories/sandbox/SandboxExecutionRepository';

function buildErroPostgres(overrides: Partial<Error & Record<string, unknown>>): Error {
  const erro = new Error(overrides.message ?? 'erro');
  return Object.assign(erro, overrides);
}

describe('classificarErro', () => {
  it('traduz erro de sintaxe (42601) extraindo o trecho problemático', () => {
    const erro = buildErroPostgres({
      code: '42601',
      message: 'syntax error at or near "FORM"',
    });

    expect(classificarErro(erro)).toEqual({
      status: 'erro_sintaxe',
      message: 'Erro de sintaxe na consulta perto de "FORM".',
    });
  });

  it('traduz tabela inexistente (42P01)', () => {
    const erro = buildErroPostgres({
      code: '42P01',
      message: 'relation "tabela_que_nao_existe" does not exist',
    });

    expect(classificarErro(erro)).toEqual({
      status: 'erro_sintaxe',
      message: 'A tabela "tabela_que_nao_existe" não existe.',
    });
  });

  it('traduz coluna inexistente (42703) usando o campo column quando presente', () => {
    const erro = buildErroPostgres({
      code: '42703',
      message: 'column "idade" does not exist',
      column: 'idade',
    });

    expect(classificarErro(erro).message).toBe('A coluna "idade" não existe.');
  });

  it('traduz violação de unicidade (23505) usando a restrição do driver', () => {
    const erro = buildErroPostgres({
      code: '23505',
      message: 'duplicate key value violates unique constraint "usuarios_email_key"',
      constraint: 'usuarios_email_key',
    });

    expect(classificarErro(erro)).toEqual({
      status: 'erro_execucao',
      message: 'Valor duplicado: já existe um registro com esse valor (restrição "usuarios_email_key").',
    });
  });

  it('traduz violação de not-null (23502)', () => {
    const erro = buildErroPostgres({
      code: '23502',
      message: 'null value in column "nome" violates not-null constraint',
      column: 'nome',
    });

    expect(classificarErro(erro).message).toBe('A coluna "nome" não pode receber valor nulo.');
  });

  it('cai numa mensagem genérica em português para código sem tradução mapeada', () => {
    const erro = buildErroPostgres({ code: '99999', message: 'some obscure postgres error' });

    expect(classificarErro(erro)).toEqual({
      status: 'erro_execucao',
      message: 'Erro ao executar a consulta (código 99999).',
    });
  });

  it('nunca deixa a mensagem original em inglês escapar', () => {
    const erro = buildErroPostgres({ code: '42P01', message: 'relation "x" does not exist' });

    expect(classificarErro(erro).message).not.toContain('does not exist');
  });
});
