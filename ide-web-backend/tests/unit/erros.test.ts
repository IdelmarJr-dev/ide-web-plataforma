import { describe, expect, it } from 'vitest';
import { NotFoundError } from '../../src/errors';

describe('NotFoundError', () => {
  it('fala português, porque a mensagem chega ao usuário', () => {
    expect(new NotFoundError('Turma').message).toBe('Turma não encontrada');
    expect(new NotFoundError('Exercício').message).toBe('Exercício não encontrado');
    expect(new NotFoundError('Prova').message).toBe('Prova não encontrada');
    expect(new NotFoundError('Usuário').message).toBe('Usuário não encontrado');
  });
});
