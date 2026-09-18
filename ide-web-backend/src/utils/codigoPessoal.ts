// Mesmo alfabeto do código de turma (sem 0/O/1/I, ambíguos) — ver
// docs/decisions/fase4-pesquisa-python-sessao-aluno-login.md.
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODIGO_LENGTH = 6;

export function gerarCodigoPessoal(): string {
  let codigo = '';
  for (let i = 0; i < CODIGO_LENGTH; i += 1) {
    codigo += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
  }
  return codigo;
}
