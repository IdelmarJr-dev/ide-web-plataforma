/**
 * O modelo às vezes formata a dica em Markdown (`**tabela**`, `` `GROUP BY` ``, `## Dica`),
 * e a janela mostra texto simples: sem esta limpeza o aluno lê os asteriscos.
 * Só tira as marcas; o texto da dica fica como o modelo escreveu.
 */
export const textoDaDica = (resposta: string): string =>
  resposta
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .trim()
