import { Position } from '@xyflow/react'

/** Geometria das ligações desenhadas nas bordas das formas (compartilhada pelos editores). */

export interface Ponto {
  x: number
  y: number
  lado: Position
}

export interface Retangulo {
  x: number
  y: number
  largura: number
  altura: number
}

export const DISTANCIA_ROTULO = 16

/**
 * Pontas da ligação nas bordas das tabelas: laterais quando uma está ao lado da outra,
 * topo/base quando estão empilhadas — a linha nunca atravessa a tabela.
 */
export function pontasDaLigacao(a: Retangulo, b: Retangulo): [Ponto, Ponto] {
  const centroA = { x: a.x + a.largura / 2, y: a.y + a.altura / 2 }
  const centroB = { x: b.x + b.largura / 2, y: b.y + b.altura / 2 }
  const separadasNaHorizontal = b.x > a.x + a.largura || a.x > b.x + b.largura

  if (separadasNaHorizontal) {
    const bADireita = centroB.x > centroA.x
    return [
      { x: bADireita ? a.x + a.largura : a.x, y: centroA.y, lado: bADireita ? Position.Right : Position.Left },
      { x: bADireita ? b.x : b.x + b.largura, y: centroB.y, lado: bADireita ? Position.Left : Position.Right },
    ]
  }
  const bAbaixo = centroB.y > centroA.y
  return [
    { x: centroA.x, y: bAbaixo ? a.y + a.altura : a.y, lado: bAbaixo ? Position.Bottom : Position.Top },
    { x: centroB.x, y: bAbaixo ? b.y : b.y + b.altura, lado: bAbaixo ? Position.Top : Position.Bottom },
  ]
}

export function posicaoDoRotulo(ponto: Ponto): { x: number; y: number } {
  switch (ponto.lado) {
    case Position.Right:
      return { x: ponto.x + DISTANCIA_ROTULO, y: ponto.y - 10 }
    case Position.Left:
      return { x: ponto.x - DISTANCIA_ROTULO, y: ponto.y - 10 }
    case Position.Bottom:
      return { x: ponto.x + 18, y: ponto.y + DISTANCIA_ROTULO }
    case Position.Top:
      return { x: ponto.x + 18, y: ponto.y - DISTANCIA_ROTULO }
  }
}

