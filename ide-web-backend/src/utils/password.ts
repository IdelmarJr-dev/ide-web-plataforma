import bcrypt from 'bcryptjs';

/**
 * Custo 10, o mínimo que a OWASP recomenda para bcrypt. Era 12 até 16/11/2026: o teste
 * de carga com a CPU do Render gratuito (0,1) mediu ~2,5 s por login, e 40 alunos
 * entrando juntos enfileiravam ~100 s de CPU no único núcleo do Node — o bcryptjs é
 * JavaScript puro e ocupa a mesma thread que atende as outras rotas. Com 10, cada login
 * custa um quarto disso. Hash antigo continua valendo e é regravado no próximo login
 * (`precisaRehash`, usado pelo AuthService).
 */
export const SALT_ROUNDS = 10;

export function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

/** Hash gravado com outro custo (os de 12, anteriores a 16/11/2026). */
export function precisaRehash(hash: string): boolean {
  const custo = /^\$2[aby]\$(\d{2})\$/.exec(hash)?.[1];
  return custo !== undefined && Number(custo) !== SALT_ROUNDS;
}
