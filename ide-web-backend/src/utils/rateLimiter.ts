// Rate limiter simples em memória, por chave — usado pra dificultar brute-force do
// código pessoal de reentrada do aluno (ver TurmaService.reentrarComoAluno). Um único
// processo é suficiente pro contexto de sala de aula deste projeto; não precisa de
// Redis/infra externa.
const janelas = new Map<string, { contagem: number; expiraEm: number }>();

export function excedeuLimite(chave: string, limite: number, janelaMs: number): boolean {
  const agora = Date.now();
  const janela = janelas.get(chave);

  if (!janela || janela.expiraEm <= agora) {
    janelas.set(chave, { contagem: 1, expiraEm: agora + janelaMs });
    return false;
  }

  janela.contagem += 1;
  return janela.contagem > limite;
}
