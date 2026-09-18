// System Usability Scale — "Escala de Usabilidade de Sistema — versão brasileira"
// (LOURENÇO; CARMONA; LOPES, 2022, Aquichan 22(2), e2228, doi:10.5294/aqui.2022.22.2.8).
// Texto literal da versão adaptada e testada no artigo (Tabela 1). Mesmo texto do
// Apêndice B do TCC — se mudar aqui, mude lá.
// Escala 1 (discordo fortemente) a 5 (concordo fortemente), itens ímpares positivos e
// pares negativos. Fórmula padrão (Brooke, 1996): soma das contribuições (0-40) × 2,5.
export const SUS_ITENS: string[] = [
  'Eu acho que gostaria de usar esse sistema frequentemente.',
  'Eu achei esse sistema desnecessariamente complexo.',
  'Eu achei esse sistema fácil de usar.',
  'Eu achei que precisaria de ajuda de uma pessoa técnica para ser capaz de usar esse sistema.',
  'Eu achei que as várias funções desse sistema foram bem integradas.',
  'Eu acho que o sistema apresenta muita inconsistência.',
  'Eu imagino que a maioria das pessoas pode aprender a usar esse sistema rapidamente.',
  'Eu achei esse sistema muito pesado para usar.',
  'Eu me senti muito seguro usando o sistema.',
  'Eu precisei aprender muitas coisas antes que pudesse utilizar esse sistema.',
]

export const SUS_ANCORAS = { minimo: 'Discordo fortemente', maximo: 'Concordo fortemente' } as const

const SUS_MULTIPLIER = 2.5

export function calcularPontuacaoSus(respostas: number[]): number {
  const contribuicoes = respostas.map((resposta, indice) => {
    const itemImpar = indice % 2 === 0
    return itemImpar ? resposta - 1 : 5 - resposta
  })
  const soma = contribuicoes.reduce((total, valor) => total + valor, 0)
  return soma * SUS_MULTIPLIER
}
