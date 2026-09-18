import { describe, expect, it } from 'vitest';
import { revisarResultadoBodySchema } from '../../src/dtos/resultado.dto';

// Fase 10, D6: a escala do IFPI é 0,0 a 10,0 — antes o DTO aceitava até 100.
describe('revisarResultadoBodySchema — escala 0 a 10', () => {
  it('aceita nota dentro da escala, com casa decimal', () => {
    expect(revisarResultadoBodySchema.safeParse({ pontuacao: 8.5 }).success).toBe(true);
    expect(revisarResultadoBodySchema.safeParse({ pontuacao: 10 }).success).toBe(true);
    expect(revisarResultadoBodySchema.safeParse({ pontuacao: 0 }).success).toBe(true);
  });

  it('recusa a escala antiga de 0 a 100', () => {
    expect(revisarResultadoBodySchema.safeParse({ pontuacao: 85 }).success).toBe(false);
    expect(revisarResultadoBodySchema.safeParse({ merAvaliacao: 100 }).success).toBe(false);
    expect(revisarResultadoBodySchema.safeParse({ dissertativaAvaliacao: 11 }).success).toBe(false);
  });

  it('recusa nota negativa', () => {
    expect(revisarResultadoBodySchema.safeParse({ pontuacao: -1 }).success).toBe(false);
  });
});
