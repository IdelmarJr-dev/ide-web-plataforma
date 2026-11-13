/**
 * Diz se o texto não tem nenhuma instrução SQL: só espaços e comentários (`-- ...` ou
 * `/* ... *\/`), como o "-- escreva sua consulta aqui" que o editor traz de início.
 *
 * O Postgres executa esse texto sem erro (não há o que rodar), mas `EXPLAIN` sobre ele dá
 * erro de sintaxe — e o envio caía num 500. Não precisa ser um parser: basta saber se
 * sobra algum caractere fora de comentário. Um `--` dentro de uma string só faz sobrar
 * mais texto, nunca menos, então não gera falso "vazio".
 */
export function sqlSemInstrucao(sql: string): boolean {
  const semComentarios = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
  return semComentarios.replace(/;/g, ' ').trim() === '';
}
