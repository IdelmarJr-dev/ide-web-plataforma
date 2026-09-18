import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('rotas de provas', () => {
  const app = createApp();

  it('exige autenticação para criar prova', async () => {
    const response = await request(app).post('/api/v1/turmas/turma-1/provas').send({ titulo: 'Prova A' });

    expect(response.status).toBe(401);
  });

  it('exige autenticação para listar provas', async () => {
    const response = await request(app).get('/api/v1/turmas/turma-1/provas');

    expect(response.status).toBe(401);
  });

  it('exige autenticação para sortear provas', async () => {
    const response = await request(app).post('/api/v1/turmas/turma-1/sortear-provas');

    expect(response.status).toBe(401);
  });
});
