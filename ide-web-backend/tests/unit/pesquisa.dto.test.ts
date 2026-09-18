import { describe, expect, it } from 'vitest';
import { acertosQuerySchema } from '../../src/dtos/pesquisa.dto';

describe('acertosQuerySchema', () => {
  const id = '123e4567-e89b-12d3-a456-426614174000';

  it('aceita UUIDs separados por vírgula, sem duplicar', () => {
    expect(acertosQuerySchema.parse({ exercicioIds: `${id}, ${id}` }).exercicioIds).toEqual([id]);
  });

  it('recusa lista vazia ou com id inválido', () => {
    expect(acertosQuerySchema.safeParse({ exercicioIds: '' }).success).toBe(false);
    expect(acertosQuerySchema.safeParse({ exercicioIds: 'nao-e-uuid' }).success).toBe(false);
  });
});
