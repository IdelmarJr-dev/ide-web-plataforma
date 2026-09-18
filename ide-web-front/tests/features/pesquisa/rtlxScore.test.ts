import { describe, expect, it } from 'vitest'
import { RTLX_DIMENSOES, calcularPontuacaoRtlx } from '../../../src/features/pesquisa/utils/rtlxScore'

describe('calcularPontuacaoRtlx', () => {
  it('retorna a média simples das 6 dimensões', () => {
    const dimensoes = Object.fromEntries(RTLX_DIMENSOES.map((dimensao, indice) => [dimensao.chave, indice * 10]))
    // (0+10+20+30+40+50) / 6 = 25
    expect(calcularPontuacaoRtlx(dimensoes)).toBe(25)
  })

  it('retorna 100 quando todas as dimensões estão no máximo', () => {
    const dimensoes = Object.fromEntries(RTLX_DIMENSOES.map((dimensao) => [dimensao.chave, 100]))
    expect(calcularPontuacaoRtlx(dimensoes)).toBe(100)
  })

  it('trata dimensão ausente como 0', () => {
    const dimensoes = { demandaMental: 60 }
    expect(calcularPontuacaoRtlx(dimensoes)).toBe(10)
  })
})
