import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { comparePassword, hashPassword, precisaRehash, SALT_ROUNDS } from '../../src/utils/password';

describe('password', () => {
  it('gera hash com o custo atual (10)', async () => {
    const hash = await hashPassword('Senha@Teste1');

    expect(SALT_ROUNDS).toBe(10);
    expect(bcrypt.getRounds(hash)).toBe(SALT_ROUNDS);
    await expect(comparePassword('Senha@Teste1', hash)).resolves.toBe(true);
  });

  it('pede rehash de hash gravado com o custo antigo (12)', () => {
    const hashAntigo = bcrypt.hashSync('Senha@Teste1', 12);

    expect(precisaRehash(hashAntigo)).toBe(true);
  });

  it('não pede rehash de hash com o custo atual', async () => {
    expect(precisaRehash(await hashPassword('Senha@Teste1'))).toBe(false);
  });

  it('não pede rehash de texto que não é hash bcrypt', () => {
    expect(precisaRehash('nao-e-hash')).toBe(false);
  });
});
