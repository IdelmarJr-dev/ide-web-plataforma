import { memo } from 'react'
import type { ReactNode } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useInternalNode } from '@xyflow/react'
import type { Edge, EdgeProps, InternalNode } from '@xyflow/react'
import { CLASSE_ROTULO_LINHA, estiloLinha } from '../../../modelagem/estilos'
import { pontasDaLigacao, posicaoDoRotulo } from '../../../modelagem/geometria'
import type { Retangulo } from '../../../modelagem/geometria'
import type { CardinalidadeFk } from '../../../modelagem/logico/operacoes'

export type FkEdgeTipo = Edge<
  { cardinalidadeReferenciada: CardinalidadeFk; cardinalidadeReferenciadora: CardinalidadeFk },
  'fk'
>

function retangulo(node: InternalNode): Retangulo {
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    largura: node.measured.width ?? 0,
    altura: node.measured.height ?? 0,
  }
}

const Rotulo = ({ ponto, texto }: { ponto: { x: number; y: number }; texto: string }): ReactNode => (
  <div
    className={`${CLASSE_ROTULO_LINHA} font-mono`}
    style={{ transform: `translate(-50%, -50%) translate(${String(ponto.x)}px, ${String(ponto.y)}px)` }}
  >
    {texto}
  </div>
)

const FkEdgeView = ({ id, source, target, data, selected }: EdgeProps<FkEdgeTipo>): ReactNode => {
  const origem = useInternalNode(source)
  const destino = useInternalNode(target)
  if (!origem || !destino || !data) return null

  const estilo = estiloLinha(selected ?? false)
  const a = retangulo(origem)

  if (source === target) {
    // Auto-relacionamento: laço na lateral direita da tabela.
    const x = a.x + a.largura
    const y1 = a.y + 14
    const y2 = a.y + Math.min(a.altura - 10, 46)
    const caminho = `M ${String(x)} ${String(y1)} C ${String(x + 60)} ${String(y1 - 10)}, ${String(x + 60)} ${String(y2 + 10)}, ${String(x)} ${String(y2)}`
    return (
      <>
        <BaseEdge id={id} path={caminho} style={estilo} />
        <EdgeLabelRenderer>
          <Rotulo ponto={{ x: x + 20, y: y1 - 12 }} texto={data.cardinalidadeReferenciada} />
          <Rotulo ponto={{ x: x + 20, y: y2 + 12 }} texto={data.cardinalidadeReferenciadora} />
        </EdgeLabelRenderer>
      </>
    )
  }

  const [pontaOrigem, pontaDestino] = pontasDaLigacao(a, retangulo(destino))
  const [caminho] = getBezierPath({
    sourceX: pontaOrigem.x,
    sourceY: pontaOrigem.y,
    sourcePosition: pontaOrigem.lado,
    targetX: pontaDestino.x,
    targetY: pontaDestino.y,
    targetPosition: pontaDestino.lado,
  })

  return (
    <>
      <BaseEdge id={id} path={caminho} style={estilo} />
      <EdgeLabelRenderer>
        <Rotulo ponto={posicaoDoRotulo(pontaOrigem)} texto={data.cardinalidadeReferenciada} />
        <Rotulo ponto={posicaoDoRotulo(pontaDestino)} texto={data.cardinalidadeReferenciadora} />
      </EdgeLabelRenderer>
    </>
  )
}

export const FkEdge = memo(FkEdgeView)
