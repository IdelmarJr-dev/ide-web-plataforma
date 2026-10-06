import { parse } from 'libpg-query';
import { describe, expect, it } from 'vitest';
import { classificarInstrucao } from '../../src/utils/sandboxScript/sqlStatementClassifier';

async function classificar(sql: string) {
  const resultado = await parse(sql);
  const stmt = resultado.stmts?.[0]?.stmt;
  if (!stmt) throw new Error(`"${sql}" não produziu nenhuma instrução`);
  return classificarInstrucao(stmt);
}

describe('classificarInstrucao — permitido em exec_<usuario_id> (schema do próprio aluno)', () => {
  it.each([
    ['SELECT', 'SELECT 1'],
    ['INSERT', "INSERT INTO minha_tabela (a) VALUES (1)"],
    ['UPDATE', 'UPDATE minha_tabela SET a = 1'],
    ['DELETE', 'DELETE FROM minha_tabela'],
    ['CREATE TABLE', 'CREATE TABLE minha_tabela (a int)'],
    ['ALTER TABLE', 'ALTER TABLE minha_tabela ADD COLUMN b int'],
    ['DROP TABLE', 'DROP TABLE minha_tabela'],
    ['CREATE VIEW', 'CREATE VIEW minha_view AS SELECT 1'],
    ['DROP VIEW', 'DROP VIEW minha_view'],
    ['CREATE INDEX', 'CREATE INDEX idx ON minha_tabela (a)'],
    ['DROP INDEX', 'DROP INDEX idx'],
    ['CREATE SEQUENCE', 'CREATE SEQUENCE minha_seq'],
    ['ALTER SEQUENCE', 'ALTER SEQUENCE minha_seq RESTART'],
    ['DROP SEQUENCE', 'DROP SEQUENCE minha_seq'],
    ['CREATE FUNCTION', 'CREATE FUNCTION minha_funcao() RETURNS int AS $$ SELECT 1 $$ LANGUAGE sql'],
    ['ALTER FUNCTION', 'ALTER FUNCTION minha_funcao() STRICT'],
    ['DROP FUNCTION', 'DROP FUNCTION minha_funcao()'],
    ['CREATE PROCEDURE', 'CREATE PROCEDURE meu_proc() LANGUAGE sql AS $$ SELECT 1 $$'],
    ['DROP PROCEDURE', 'DROP PROCEDURE meu_proc()'],
    ['CREATE TRIGGER', 'CREATE TRIGGER t BEFORE INSERT ON minha_tabela FOR EACH ROW EXECUTE FUNCTION f()'],
    ['DROP TRIGGER', 'DROP TRIGGER t ON minha_tabela'],
    ['CREATE TYPE (composto)', 'CREATE TYPE ponto AS (x int, y int)'],
    ['CREATE TYPE (enum)', "CREATE TYPE cor AS ENUM ('a', 'b')"],
    ['CREATE TYPE (range)', 'CREATE TYPE faixa AS RANGE (subtype = int4)'],
    ['ALTER TYPE ADD VALUE', "ALTER TYPE cor ADD VALUE 'c'"],
    ['DROP TYPE', 'DROP TYPE cor'],
    ['DO $$ $$', "DO $$ BEGIN RAISE NOTICE 'x'; END $$"],
    ['GRANT em objeto próprio', 'GRANT SELECT ON minha_tabela TO foo'],
    ['REVOKE em objeto próprio', 'REVOKE SELECT ON minha_tabela FROM foo'],
    ['SET ROLE', 'SET ROLE minha_role'],
    ['RESET ROLE', 'RESET ROLE'],
  ])('%s é permitida na rota execucao_aluno', async (_rotulo, sql) => {
    const classificacao = await classificar(sql);
    expect(classificacao.permitida).toBe(true);
    expect(classificacao).toMatchObject({ permitida: true, rota: 'execucao_aluno' });
  });
});

describe('classificarInstrucao — administração de role (conexão CREATEROLE-only, etapa 5)', () => {
  it.each([
    ['CREATE ROLE', 'CREATE ROLE foo'],
    ['DROP ROLE', 'DROP ROLE foo'],
    ['GRANT papel TO papel', 'GRANT foo TO bar'],
  ])('%s é permitida na rota administracao_role', async (_rotulo, sql) => {
    const classificacao = await classificar(sql);
    expect(classificacao).toMatchObject({ permitida: true, rota: 'administracao_role' });
  });
});

describe('classificarInstrucao — referência a outro schema é sempre rejeitada (qualificador do AST, nunca texto)', () => {
  it.each([
    ['CREATE TABLE', 'CREATE TABLE outro_schema.t (a int)'],
    ['ALTER TABLE', 'ALTER TABLE outro_schema.t ADD COLUMN b int'],
    ['DROP TABLE', 'DROP TABLE outro_schema.t'],
    ['DROP TABLE (um de vários qualificado)', 'DROP TABLE minha_tabela, outro_schema.t'],
    ['CREATE VIEW', 'CREATE VIEW outro_schema.v AS SELECT 1'],
    ['DROP VIEW', 'DROP VIEW outro_schema.v'],
    ['CREATE INDEX', 'CREATE INDEX idx ON outro_schema.t (a)'],
    ['DROP INDEX', 'DROP INDEX outro_schema.idx'],
    ['CREATE SEQUENCE', 'CREATE SEQUENCE outro_schema.s'],
    ['ALTER SEQUENCE', 'ALTER SEQUENCE outro_schema.s RESTART'],
    ['DROP SEQUENCE', 'DROP SEQUENCE outro_schema.s'],
    ['CREATE FUNCTION', 'CREATE FUNCTION outro_schema.f() RETURNS int AS $$ SELECT 1 $$ LANGUAGE sql'],
    ['ALTER FUNCTION', 'ALTER FUNCTION outro_schema.f() STRICT'],
    ['DROP FUNCTION', 'DROP FUNCTION outro_schema.f()'],
    ['CREATE TRIGGER', 'CREATE TRIGGER t BEFORE INSERT ON outro_schema.t FOR EACH ROW EXECUTE FUNCTION f()'],
    ['DROP TRIGGER', 'DROP TRIGGER t ON outro_schema.t'],
    ['CREATE TYPE (composto)', 'CREATE TYPE outro_schema.ponto AS (x int)'],
    ['DROP TYPE', 'DROP TYPE outro_schema.meu_tipo'],
    ['GRANT em objeto de outro schema', 'GRANT SELECT ON outro_schema.t TO foo'],
    ['REVOKE em objeto de outro schema', 'REVOKE SELECT ON outro_schema.t FROM foo'],
  ])('%s qualificado é rejeitada', async (_rotulo, sql) => {
    const classificacao = await classificar(sql);
    expect(classificacao.permitida).toBe(false);
    if (!classificacao.permitida) {
      expect(classificacao.motivo).toMatch(/outro schema/i);
    }
  });
});

describe('classificarInstrucao — comandos que mudam contexto de sessão (D12)', () => {
  it('SET SESSION AUTHORIZATION é rejeitado nomeadamente', async () => {
    const classificacao = await classificar('SET SESSION AUTHORIZATION foo');
    expect(classificacao).toMatchObject({ permitida: false });
    if (!classificacao.permitida) expect(classificacao.motivo).toMatch(/SESSION AUTHORIZATION/);
  });

  it('SET search_path é rejeitado nomeadamente', async () => {
    const classificacao = await classificar('SET search_path TO outro_schema');
    expect(classificacao).toMatchObject({ permitida: false });
    if (!classificacao.permitida) expect(classificacao.motivo).toMatch(/search_path/);
  });

  it('qualquer outro SET fora de ROLE cai em default-deny', async () => {
    const classificacao = await classificar('SET statement_timeout = 100');
    expect(classificacao).toMatchObject({ permitida: false });
  });
});

describe('classificarInstrucao — rejeitados sempre, nomeados explicitamente', () => {
  it.each([
    ['ALTER SYSTEM', "ALTER SYSTEM SET foo = 'bar'"],
    ['CREATE EXTENSION', 'CREATE EXTENSION foo'],
    ['DROP EXTENSION', 'DROP EXTENSION foo'],
    ['COPY ... TO PROGRAM', "COPY minha_tabela TO PROGRAM 'ls'"],
    ['ALTER ROLE', 'ALTER ROLE foo SUPERUSER'],
    ['LISTEN', 'LISTEN foo'],
    ['NOTIFY', 'NOTIFY foo'],
    ['UNLISTEN', 'UNLISTEN foo'],
    ['CREATE SCHEMA', 'CREATE SCHEMA foo'],
    ['GRANT ALL IN SCHEMA', 'GRANT SELECT ON ALL TABLES IN SCHEMA outro TO foo'],
  ])('%s é rejeitado', async (_rotulo, sql) => {
    const classificacao = await classificar(sql);
    expect(classificacao.permitida).toBe(false);
  });
});

describe('classificarInstrucao — default-deny pra tipo de nó não listado', () => {
  it('instrução fora da lista branca cai no default, nunca passa por omissão', async () => {
    const classificacao = await classificar('VACUUM minha_tabela');
    expect(classificacao).toMatchObject({ permitida: false });
    if (!classificacao.permitida) expect(classificacao.motivo).toContain('VacuumStmt');
  });
});
