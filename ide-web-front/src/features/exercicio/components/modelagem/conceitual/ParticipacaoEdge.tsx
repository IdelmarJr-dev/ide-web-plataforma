import { memo } from 'react'
import type { ReactNode } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useInternalNode } from '@xyflow/react'
import type { Edge, EdgeProps, InternalNode } from '@xyflow/react'
import { CLASSE_ROTULO_LINHA, estiloLinha } from '../../../modelagem/estilos'
import { posicaoDoRotulo, pontasDaLigacao } from '../../../modelagem/geometria'
import type { Retangulo } from '../../../modelagem/geometria'

export type ParticipacaoEdgeTipo = Edge<{ min: 0 | 1; max: '1' | 'n'; papel: string; curvatura: number }, 'participacao'>

function retangulo(node: InternalNode): Retangulo {
  return { x: node.internals.positionAbsolute.x, y: node.internals.positionAbsolute.y, largura: node.measured.width ?? 0, altura: node.measured.height ?? 0 }
}

const Rotulo = ({ ponto, texto, estilo }: { ponto: { x: number; y: number }; texto: string; estilo?: string }): ReactNode => (
  <div
    className={`${CLASSE_ROTULO_LINHA} ${estilo ?? 'font-mono'}`}
    style={{ transform: `translate(-50%, -50%) translate(${String(ponto.x)}px, ${String(ponto.y)}px)` }}
  >
    {texto}
  </div>
)

/**
 * Liga relacionamento (source) à entidade (target). O `(mín,máx)` fica junto da
 * entidade — convenção Heuser: quantas ocorrências dela participam de uma ocorrência
 * da outra ponta. Participações repetidas entre o mesmo par (auto-relacionamento)
 * ganham curvaturas diferentes pra não se sobrepor.
 */
const ParticipacaoEdgeView = ({ id, source, target, data, selected }: EdgeProps<ParticipacaoEdgeTipo>): ReactNode => {
  const origem = useInternalNode(source)
  const destino = useInternalNode(target)
  if (!origem || !destino || !data) return null

  const estilo = estiloLinha(selected ?? false)
  const [pontaOrigem, pontaDestino] = pontasDaLigacao(retangulo(origem), retangulo(destino))
  const [caminho, labelX, labelY] = getBezierPath({
    sourceX: pontaOrigem.x,
    sourceY: pontaOrigem.y,
    sourcePosition: pontaOrigem.lado,
    targetX: pontaDestino.x,
    targetY: pontaDestino.y,
    targetPosition: pontaDestino.lado,
    curvature: data.curvatura,
  })

  return (
    <>
      <BaseEdge id={id} path={caminho} style={estilo} />
      <EdgeLabelRenderer>
        <Rotulo ponto={posicaoDoRotulo(pontaDestino)} texto={`(${String(data.min)},${data.max})`} />
        {data.papel ? <Rotulo ponto={{ x: labelX, y: labelY }} texto={data.papel} estilo="italic" /> : null}
      </EdgeLabelRenderer>
    </>
  )
}

export const ParticipacaoEdge = memo(ParticipacaoEdgeView)
