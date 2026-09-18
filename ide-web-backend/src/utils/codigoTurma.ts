const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODIGO_LENGTH = 6;

export function gerarCodigoTurma(): string {
  let codigo = '';
  for (let i = 0; i < CODIGO_LENGTH; i += 1) {
    codigo += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
  }
  return codigo;
}
