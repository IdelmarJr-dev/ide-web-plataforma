import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('rotas do painel', () => {
  const app = createApp();

  it('exige autenticação para o painel do professor', async () => {
    const response = await request(app).get('/api/v1/painel/professor');

    expect(response.status).toBe(401);
  });

  it('exige autenticação para o painel do aluno', async () => {
    const response = await request(app).get('/api/v1/painel/aluno');

    expect(response.status).toBe(401);
  });

  it('exige autenticação para a matriz da turma', async () => {
    const response = await request(app).get('/api/v1/turmas/turma-1/painel');

    expect(response.status).toBe(401);
  });

  // "painel" não pode ser capturado como :id de outra rota de turma.
  it('não confunde /turmas/:id/painel com as rotas vizinhas de turma', async () => {
    const response = await request(app).get('/api/v1/turmas/turma-1/painel');

    expect(response.status).not.toBe(404);
  });
});
