import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';

describe('rotas de turmas', () => {
  const app = createApp();

  it('exige autenticação para criar turma', async () => {
    const response = await request(app).post('/api/v1/turmas').send({ nome: 'Turma A', semestre: '2026.2' });

    expect(response.status).toBe(401);
  });

  it('exige autenticação para listar alunos da turma', async () => {
    const response = await request(app).get('/api/v1/turmas/turma-1/alunos');

    expect(response.status).toBe(401);
  });

  // O código da turma virou matrícula, não credencial: matricular exige estar logado
  // (docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md).
  it('exige autenticação para se matricular com o código da turma', async () => {
    const response = await request(app).post('/api/v1/turmas/ABC123/matricular').send({});

    expect(response.status).toBe(401);
  });

  it('não expõe mais as rotas da sessão leve do aluno', async () => {
    const entrar = await request(app).post('/api/v1/turmas/ABC123/entrar').send({ nome: 'Aluno' });
    const reentrar = await request(app).post('/api/v1/turmas/ABC123/reentrar').send({ codigoPessoal: 'ABC234' });

    expect(entrar.status).toBe(404);
    expect(reentrar.status).toBe(404);
  });

  it('exige autenticação para encerrar turma', async () => {
    const response = await request(app).post('/api/v1/turmas/turma-1/encerrar').send({});

    expect(response.status).toBe(401);
  });
});
