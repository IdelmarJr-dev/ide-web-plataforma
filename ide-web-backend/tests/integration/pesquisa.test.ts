import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('rotas de pesquisa', () => {
  const app = createApp();

  it('exige autenticação para consultar minha participação', async () => {
    const response = await request(app).get('/api/v1/pesquisa/minha-participacao');

    expect(response.status).toBe(401);
  });

  it('exige autenticação para iniciar uma pesquisa', async () => {
    const response = await request(app).post('/api/v1/pesquisa/iniciar').send({});

    expect(response.status).toBe(401);
  });

  it('exige autenticação para consultar os acertos da tarefa', async () => {
    const response = await request(app).get('/api/v1/pesquisa/acertos?exercicioIds=123e4567-e89b-12d3-a456-426614174000');

    expect(response.status).toBe(401);
  });
});
