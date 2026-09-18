import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('rotas de dicas de IA', () => {
  const app = createApp();

  it('exige autenticação para pedir dica', async () => {
    const response = await request(app)
      .post('/api/v1/exercicios/exercicio-1/dicas')
      .send({ contexto: 'sql', estadoSql: 'SELECT * FROM usuarios' });

    expect(response.status).toBe(401);
  });
});
