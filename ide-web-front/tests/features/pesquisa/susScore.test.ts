import { describe, expect, it } from 'vitest'
import { calcularPontuacaoSus } from '../../../src/features/pesquisa/utils/susScore'

describe('calcularPontuacaoSus', () => {
  it('retorna 100 quando todas as respostas são as mais favoráveis possíveis', () => {
    // ímpares (positivas) = 5 (concordo totalmente); pares (negativas) = 1 (discordo totalmente)
    const respostas = [5, 1, 5, 1, 5, 1, 5, 1, 5, 1]
    expect(calcularPontuacaoSus(respostas)).toBe(100)
  })

  it('retorna 0 quando todas as respostas são as menos favoráveis possíveis', () => {
    const respostas = [1, 5, 1, 5, 1, 5, 1, 5, 1, 5]
    expect(calcularPontuacaoSus(respostas)).toBe(0)
  })

  it('retorna 50 quando todas as respostas são neutras (3)', () => {
    const respostas = new Array(10).fill(3) as number[]
    expect(calcularPontuacaoSus(respostas)).toBe(50)
  })
})
