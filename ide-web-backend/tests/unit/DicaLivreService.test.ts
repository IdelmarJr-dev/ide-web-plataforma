import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LlmClient } from '../../src/repositories/llm/GroqLlmClient';
import { DicaLivreService } from '../../src/services/DicaLivreService';

const LIMITE_PEDIDOS_POR_JANELA = 10;

describe('DicaLivreService', () => {
  const gerarDica = vi.fn<LlmClient['gerarDica']>();
  const llmClient: LlmClient = { gerarDica };
  const service = new DicaLivreService(llmClient);

  beforeEach(() => {
    vi.clearAllMocks();
    gerarDica.mockResolvedValue({ texto: 'Revise a cláusula WHERE.', tokensUsados: 10 });
  });

  it('retorna a resposta da IA pro SQL enviado', async () => {
    const resposta = await service.pedir('aluno-1', { sql: 'SELECT * FROM cliente' });

    expect(resposta).toBe('Revise a cláusula WHERE.');
    expect(gerarDica).toHaveBeenCalledTimes(1);
  });

  it('inclui o objetivo informado no prompt', async () => {
    await service.pedir('aluno-1', { sql: 'SELECT * FROM cliente', objetivo: 'listar clientes ativos' });

    const promptEnviado = gerarDica.mock.calls[0]?.[0] ?? '';
    expect(promptEnviado).toContain('listar clientes ativos');
  });

  it('avisa quando o objetivo não foi informado, sem quebrar o prompt', async () => {
    await service.pedir('aluno-1', { sql: 'SELECT * FROM cliente' });

    const promptEnviado = gerarDica.mock.calls[0]?.[0] ?? '';
    expect(promptEnviado).toContain('não disse o que está tentando fazer');
  });

  it('rejeita o 11º pedido na mesma janela de tempo', async () => {
    for (let indice = 0; indice < LIMITE_PEDIDOS_POR_JANELA; indice += 1) {
      await service.pedir('aluno-2', { sql: 'SELECT 1' });
    }

    await expect(service.pedir('aluno-2', { sql: 'SELECT 1' })).rejects.toThrow();
  });

  it('conta a janela por aluno, sem afetar outro usuário', async () => {
    for (let indice = 0; indice < LIMITE_PEDIDOS_POR_JANELA; indice += 1) {
      await service.pedir('aluno-3', { sql: 'SELECT 1' });
    }

    await expect(service.pedir('aluno-4', { sql: 'SELECT 1' })).resolves.toBe('Revise a cláusula WHERE.');
  });
});
