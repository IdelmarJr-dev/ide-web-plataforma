// Raw NASA-TLX (Hart, 2006) — 6 dimensões, cada uma de 0 a 100 em passos de 5 (as 21
// marcas da escala original), sem a comparação par a par do NASA-TLX completo. Todas
// na mesma direção (maior = mais carga), inclusive Desempenho (0 = perfeito, 100 =
// fracasso), pra que a média das 6 seja diretamente a nota. Mesmo texto do Apêndice B
// do TCC — se mudar aqui, mude lá.
export interface RtlxDimensao {
  chave: string
  titulo: string
  pergunta: string
  ancoraMinimo: string
  ancoraMaximo: string
}

export const RTLX_MIN = 0
export const RTLX_MAX = 100
export const RTLX_PASSO = 5

export const RTLX_DIMENSOES: RtlxDimensao[] = [
  {
    chave: 'demandaMental',
    titulo: 'Demanda mental',
    pergunta: 'Quão mentalmente exigente foi a tarefa?',
    ancoraMinimo: 'Muito baixa',
    ancoraMaximo: 'Muito alta',
  },
  {
    chave: 'demandaFisica',
    titulo: 'Demanda física',
    pergunta: 'Quão fisicamente exigente foi a tarefa?',
    ancoraMinimo: 'Muito baixa',
    ancoraMaximo: 'Muito alta',
  },
  {
    chave: 'demandaTemporal',
    titulo: 'Demanda temporal',
    pergunta: 'Quão apressado foi o ritmo da tarefa?',
    ancoraMinimo: 'Muito baixa',
    ancoraMaximo: 'Muito alta',
  },
  {
    chave: 'desempenho',
    titulo: 'Desempenho',
    pergunta: 'Quão bem-sucedido você foi em realizar o que foi pedido?',
    ancoraMinimo: 'Perfeito',
    ancoraMaximo: 'Fracasso',
  },
  {
    chave: 'esforco',
    titulo: 'Esforço',
    pergunta: 'Quão duro você teve que trabalhar para atingir seu nível de desempenho?',
    ancoraMinimo: 'Muito baixo',
    ancoraMaximo: 'Muito alto',
  },
  {
    chave: 'frustracao',
    titulo: 'Frustração',
    pergunta: 'Quão inseguro, desencorajado, irritado ou estressado você se sentiu?',
    ancoraMinimo: 'Muito baixa',
    ancoraMaximo: 'Muito alta',
  },
]

export function calcularPontuacaoRtlx(dimensoes: Record<string, number>): number {
  const valores = RTLX_DIMENSOES.map((dimensao) => dimensoes[dimensao.chave] ?? 0)
  const soma = valores.reduce((total, valor) => total + valor, 0)
  return Math.round((soma / RTLX_DIMENSOES.length) * 100) / 100
}
