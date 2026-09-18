import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgSandboxExecutionRepository } from '../../src/repositories/sandbox/SandboxExecutionRepository';
import { PgSandboxProvisioningRepository } from '../../src/repositories/sandbox/SandboxProvisioningRepository';
import { nomeSchemaSandboxLivre } from '../../src/utils/sandboxSchema';

/**
 * Suíte de caracterização (Fase 12, D8) do comportamento externamente visível de
 * `SandboxExecutionRepository.executar` — grava o formato de hoje (status/rows/message)
 * como referência, e serve também de teste de regressão pra D13: uma role de execução
 * por aluno, e não mais uma `sandbox_exec` global, não pode enxergar o schema de outro
 * aluno mesmo com nome qualificado.
 *
 * Exige o serviço `db_sandbox` do docker-compose.yml da raiz de pé (`SANDBOX_DATABASE_URL`
 * / `SANDBOX_EXEC_DATABASE_URL` do `.env`) — é a primeira suíte deste projeto a rodar
 * contra o Postgres real do sandbox, e não contra dublês.
 */
describe('identidade de execução do sandbox SQL (Fase 12, D13/D14)', () => {
  const TIMEOUT_MS = 5000;
  const provisioning = new PgSandboxProvisioningRepository();
  const execucao = new PgSandboxExecutionRepository();

  const usuarioA = randomUUID();
  const usuarioB = randomUUID();
  const schemaA = nomeSchemaSandboxLivre(usuarioA);
  const schemaB = nomeSchemaSandboxLivre(usuarioB);

  beforeAll(async () => {
    await provisioning.garantirSchemaLivre(schemaA, usuarioA);
    await provisioning.garantirSchemaLivre(schemaB, usuarioB);
  });

  afterAll(async () => {
    await provisioning.dropSchema(schemaA);
    await provisioning.dropSchema(schemaB);
  });

  describe('formato de resposta (caracterização)', () => {
    it('SELECT simples devolve status sucesso e as linhas', async () => {
      const resultado = await execucao.executar(schemaA, usuarioA, 'SELECT 1 AS valor', TIMEOUT_MS);

      expect(resultado).toEqual({ status: 'sucesso', rows: [{ valor: 1 }] });
    });

    it('CREATE TABLE seguido de INSERT/UPDATE/DELETE funciona no próprio schema', async () => {
      await execucao.executar(schemaA, usuarioA, 'CREATE TABLE nota (id SERIAL PRIMARY KEY, valor INT)', TIMEOUT_MS);
      await execucao.executar(schemaA, usuarioA, 'INSERT INTO nota (valor) VALUES (10)', TIMEOUT_MS);
      await execucao.executar(schemaA, usuarioA, 'UPDATE nota SET valor = 20 WHERE valor = 10', TIMEOUT_MS);

      const selecionado = await execucao.executar(schemaA, usuarioA, 'SELECT valor FROM nota', TIMEOUT_MS);
      expect(selecionado).toEqual({ status: 'sucesso', rows: [{ valor: 20 }] });

      const apagado = await execucao.executar(schemaA, usuarioA, 'DELETE FROM nota', TIMEOUT_MS);
      expect(apagado).toEqual({ status: 'sucesso', rows: [] });
    });

    it('erro de sintaxe devolve status erro_sintaxe com mensagem', async () => {
      const resultado = await execucao.executar(schemaA, usuarioA, 'SELECT FROM', TIMEOUT_MS);

      expect(resultado.status).toBe('erro_sintaxe');
      expect('message' in resultado && resultado.message.length > 0).toBe(true);
    });

    // Achado ao rodar esta suíte pela primeira vez contra Postgres real: `classificarErro`
    // (SandboxExecutionRepository) trata todo SQLSTATE da classe 42 como erro_sintaxe, e
    // "tabela inexistente" é 42P01 (undefined_table) — cai nessa classe, não em
    // erro_execucao. Documentado aqui como comportamento real de hoje, não corrigido:
    // mudar isso é decisão de produto (a mensagem que chega ao aluno), fora do escopo
    // desta suíte, que só caracteriza o que já existe.
    it('tabela inexistente (SQLSTATE 42P01, classe "sintaxe" nesta classificação) devolve erro_sintaxe', async () => {
      const resultado = await execucao.executar(schemaA, usuarioA, 'SELECT * FROM tabela_que_nao_existe', TIMEOUT_MS);

      expect(resultado.status).toBe('erro_sintaxe');
      expect('message' in resultado && resultado.message.length > 0).toBe(true);
    });

    it('violação de restrição (UNIQUE, SQLSTATE 23505) devolve status erro_execucao com mensagem', async () => {
      await execucao.executar(schemaA, usuarioA, 'CREATE TABLE codigo_unico (valor INT UNIQUE)', TIMEOUT_MS);
      await execucao.executar(schemaA, usuarioA, 'INSERT INTO codigo_unico (valor) VALUES (1)', TIMEOUT_MS);

      const resultado = await execucao.executar(schemaA, usuarioA, 'INSERT INTO codigo_unico (valor) VALUES (1)', TIMEOUT_MS);

      expect(resultado.status).toBe('erro_execucao');
      expect('message' in resultado && resultado.message.length > 0).toBe(true);
    });
  });

  describe('isolamento entre alunos (regressão do achado D13)', () => {
    it('a role de execução do aluno A não enxerga o schema do aluno B, mesmo com nome qualificado', async () => {
      await execucao.executar(schemaB, usuarioB, 'CREATE TABLE segredo (id SERIAL PRIMARY KEY)', TIMEOUT_MS);

      const tentativa = await execucao.executar(
        schemaA,
        usuarioA,
        `SELECT * FROM "${schemaB}".segredo`,
        TIMEOUT_MS,
      );

      // Antes da Fase 12, uma role sandbox_exec global e compartilhada teria privilégio
      // real sobre os dois schemas simultaneamente — isso precisa falhar por permissão.
      // "permission denied for schema" é SQLSTATE 42501, mesma classe "42" que
      // classificarErro trata como erro_sintaxe (ver nota acima) — o que importa aqui
      // não é o rótulo, é que a consulta NÃO teve sucesso.
      expect(tentativa.status).not.toBe('sucesso');
      if (tentativa.status === 'sucesso') throw new Error('não deveria ter sucesso');
      expect(tentativa.message.toLowerCase()).toContain('permission denied');
    });
  });
});
