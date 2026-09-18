import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('rotas de exercícios', () => {
  const app = createApp();

  it('exige autenticação para criar exercício', async () => {
    const response = await request(app).post('/api/v1/exercicios').send({});

    expect(response.status).toBe(401);
  });

  it('exige autenticação para listar exercícios de uma turma', async () => {
    const response = await request(app).get('/api/v1/turmas/turma-1/exercicios');

    expect(response.status).toBe(401);
  });

  it('exige autenticação para buscar um exercício por id', async () => {
    const response = await request(app).get('/api/v1/exercicios/exercicio-1');

    expect(response.status).toBe(401);
  });

  it('exige autenticação para liberar gabarito', async () => {
    const response = await request(app).post('/api/v1/exercicios/exercicio-1/liberar-gabarito');

    expect(response.status).toBe(401);
  });

  it('exige autenticação para consultar meu resultado', async () => {
    const response = await request(app).get('/api/v1/exercicios/exercicio-1/resultado');

    expect(response.status).toBe(401);
  });

  it('exige autenticação para consultar o resultado de um aluno específico', async () => {
    const response = await request(app).get('/api/v1/exercicios/exercicio-1/alunos/aluno-1/resultado');

    expect(response.status).toBe(401);
  });

  // Fase 10, D8: a válvula do modo prova é só do professor.
  it('exige autenticação para liberar um novo envio ao aluno', async () => {
    const response = await request(app).post('/api/v1/exercicios/exercicio-1/alunos/aluno-1/liberar-envio').send({});

    expect(response.status).toBe(401);
  });

  // Fase 9, D17: a rota é irmã da de resultado e roda o mesmo requireAuth/requirePapel.
  it('exige autenticação para consultar as respostas entregues por um aluno', async () => {
    const response = await request(app).get('/api/v1/exercicios/exercicio-1/alunos/aluno-1/respostas');

    expect(response.status).toBe(401);
  });

  it('exige autenticação para salvar o diagrama MER', async () => {
    const response = await request(app).put('/api/v1/exercicios/exercicio-1/diagrama').send({ conteudoJson: {} });

    expect(response.status).toBe(401);
  });

  it('exige autenticação para buscar o diagrama MER', async () => {
    const response = await request(app).get('/api/v1/exercicios/exercicio-1/diagrama');

    expect(response.status).toBe(401);
  });

  it('exige autenticação para testar SQL no sandbox', async () => {
    const response = await request(app)
      .post('/api/v1/exercicios/exercicio-1/sandbox/testar')
      .send({ sql: 'SELECT 1' });

    expect(response.status).toBe(401);
  });

  it('exige autenticação para enviar SQL no sandbox', async () => {
    const response = await request(app)
      .post('/api/v1/exercicios/exercicio-1/sandbox/enviar')
      .send({ sql: 'SELECT 1' });

    expect(response.status).toBe(401);
  });

  it('exige autenticação para gerar o pacote em PDF', async () => {
    const response = await request(app).post('/api/v1/exercicios/exercicio-1/pacote').send({});

    expect(response.status).toBe(401);
  });
});
