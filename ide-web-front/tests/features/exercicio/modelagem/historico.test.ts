import { describe, expect, it } from 'vitest'
import {
  criarHistorico,
  LIMITE_HISTORICO,
  reduzirHistorico,
} from '../../../../src/features/exercicio/modelagem/historico'
import type { AcaoHistorico, Historico } from '../../../../src/features/exercicio/modelagem/historico'

function aplicarTodas(inicial: number, acoes: AcaoHistorico<number>[]): Historico<number> {
  return acoes.reduce(reduzirHistorico<number>, criarHistorico(inicial))
}

describe('histórico de desfazer/refazer', () => {
  it('desfaz e refaz na ordem', () => {
    const estado = aplicarTodas(0, [
      { tipo: 'aplicar', valor: 1, chave: null },
      { tipo: 'aplicar', valor: 2, chave: null },
      { tipo: 'desfazer' },
    ])
    expect(estado.presente).toBe(1)

    const refeito = reduzirHistorico(estado, { tipo: 'refazer' })
    expect(refeito.presente).toBe(2)
    expect(refeito.futuro).toEqual([])
  })

  it('mudanças seguidas com a mesma chave viram um passo só, até encerrar o gesto', () => {
    const estado = aplicarTodas(0, [
      { tipo: 'aplicar', valor: 1, chave: 'mover:t1' },
      { tipo: 'aplicar', valor: 2, chave: 'mover:t1' },
      { tipo: 'aplicar', valor: 3, chave: 'mover:t1' },
      { tipo: 'encerrarGesto' },
      { tipo: 'aplicar', valor: 4, chave: 'mover:t1' },
    ])

    expect(estado.passado).toEqual([0, 3])
    expect(reduzirHistorico(estado, { tipo: 'desfazer' }).presente).toBe(3)
  })

  it('aplicar depois de desfazer descarta o futuro', () => {
    const estado = aplicarTodas(0, [
      { tipo: 'aplicar', valor: 1, chave: null },
      { tipo: 'desfazer' },
      { tipo: 'aplicar', valor: 5, chave: null },
    ])

    expect(estado.futuro).toEqual([])
    expect(reduzirHistorico(estado, { tipo: 'refazer' })).toBe(estado)
  })

  it('aceita função que recebe o estado atual', () => {
    const estado = aplicarTodas(10, [
      { tipo: 'aplicar', valor: (atual) => atual + 1, chave: null },
      { tipo: 'aplicar', valor: (atual) => atual * 2, chave: null },
    ])

    expect(estado.presente).toBe(22)
  })

  it('ignora mudança que devolve o mesmo valor e ações sem efeito', () => {
    const inicial = criarHistorico(7)

    expect(reduzirHistorico(inicial, { tipo: 'aplicar', valor: 7, chave: null })).toBe(inicial)
    expect(reduzirHistorico(inicial, { tipo: 'desfazer' })).toBe(inicial)
    expect(reduzirHistorico(inicial, { tipo: 'encerrarGesto' })).toBe(inicial)
  })

  it(`guarda no máximo ${String(LIMITE_HISTORICO)} estados`, () => {
    const acoes: AcaoHistorico<number>[] = Array.from({ length: LIMITE_HISTORICO + 20 }, (_, i) => ({
      tipo: 'aplicar',
      valor: i + 1,
      chave: null,
    }))

    expect(aplicarTodas(0, acoes).passado).toHaveLength(LIMITE_HISTORICO)
  })

  it('redefinir recomeça o histórico', () => {
    const estado = aplicarTodas(0, [{ tipo: 'aplicar', valor: 1, chave: null }, { tipo: 'redefinir', valor: 9 }])

    expect(estado).toEqual(criarHistorico(9))
  })
})
