import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, ReactNode, RefObject } from 'react'
import { Background, BackgroundVariant, ConnectionMode, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import type { EdgeChange, EdgeTypes, NodeChange, NodeTypes, OnConnectEnd } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ModeloLogico } from '../../../modelagem/documento'
import { gerarSql } from '../../../modelagem/gerarSql'
import { normalizarIdentificador } from '../../../modelagem/identificadores'
import { LogicoEditorContexto } from '../../../modelagem/logico/editorContexto'
import type { LogicoEditorAcoes, SelecaoLogico } from '../../../modelagem/logico/editorContexto'
import {
  adicionarNota,
  adicionarTabela,
  atualizarNota,
  duplicarTabela,
  ligacoesFk,
  ligarTabelas,
  moverTabela,
  removerColuna,
  removerLigacao,
  removerNota,
  removerTabela,
  renomearTabela,
} from '../../../modelagem/logico/operacoes'
import type { Posicao } from '../../../modelagem/logico/operacoes'
import type { Selecao } from '../../../modelagem/sincronizacao'
import { BarraFerramentas, BotaoIcone } from '../BarraFerramentas'
import { NotaNode } from '../NotaNode'
import type { NotaNodeTipo } from '../NotaNode'
import { Paleta, TIPO_ARRASTO_PALETA } from '../Paleta'
import type { ItemPaleta } from '../Paleta'
import { FkEdge } from './FkEdge'
import type { FkEdgeTipo } from './FkEdge'
import { PainelPropriedadesLogico } from './PainelPropriedadesLogico'
import { TabelaNode } from './TabelaNode'
import type { TabelaNodeTipo } from './TabelaNode'

// Fora do componente: o React Flow re-renderiza tudo se esses objetos mudarem de identidade.
const NODE_TYPES: NodeTypes = { tabela: TabelaNode, nota: NotaNode }
const EDGE_TYPES: EdgeTypes = { fk: FkEdge }
const GRADE: [number, number] = [16, 16]
const TEMPO_MENSAGEM_MS = 4000

type NoLogico = TabelaNodeTipo | NotaNodeTipo
type ElementoPaleta = 'tabela' | 'nota'

const ITENS_PALETA: ItemPaleta<ElementoPaleta>[] = [
  { tipo: 'tabela', rotulo: 'Tabela', icone: <span className="inline-block h-4 w-6 rounded-sm border-2 border-neutral-700 border-t-4" /> },
  { tipo: 'nota', rotulo: 'Nota', icone: <span className="inline-block h-4 w-5 rounded-sm border border-amber-400 bg-amber-100" /> },
]

export interface ControleHistorico {
  podeDesfazer: boolean
  podeRefazer: boolean
  desfazer: () => void
  refazer: () => void
  encerrarGesto: () => void
}

export interface LogicoEditorProps {
  logico: ModeloLogico
  onAplicar: (atualizar: (logico: ModeloLogico) => ModeloLogico, chave?: string) => void
  historico: ControleHistorico
  somenteLeitura?: boolean
  destaque?: Selecao | null
  onSelecionar?: (selecao: Selecao) => void
  // Itens do lado direito da barra (indicador de salvamento, dica de IA).
  barraDireita?: ReactNode
  // Área capturada como imagem no PDF do exercício.
  canvasRef?: RefObject<HTMLDivElement | null> | undefined
}

function ehCampoDeTexto(alvo: EventTarget): boolean {
  return alvo instanceof HTMLElement && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))
}

const semSincronizacao = (): void => undefined

// Em tela estreita o painel cobre o desenho inteiro: a ajuda só abre sozinha quando há
// espaço pros dois (o botão "?" continua abrindo em qualquer largura).
const LARGURA_MINIMA_PARA_AJUDA = 1024

function cabeAjudaLadoALado(): boolean {
  return typeof window === 'undefined' || window.innerWidth >= LARGURA_MINIMA_PARA_AJUDA
}

const LogicoEditorInterno = ({
  logico,
  onAplicar,
  historico,
  somenteLeitura = false,
  destaque = null,
  onSelecionar = semSincronizacao,
  barraDireita,
  canvasRef,
}: LogicoEditorProps): ReactNode => {
  const { screenToFlowPosition, fitView } = useReactFlow()
  const areaRef = useRef<HTMLDivElement>(null)
  const canvasInternoRef = useRef<HTMLDivElement | null>(null)
  // Enquanto o aluno não mexe na visão, reenquadra quando a área muda de tamanho (o painel
  // de SQL abaixo cresce depois de carregar e cortava o desenho).
  const interagiuRef = useRef(false)
  const [selecao, setSelecao] = useState<SelecaoLogico | null>(null)
  const [medidas, setMedidas] = useState<Map<string, { width: number; height: number }>>(new Map())
  const [grade, setGrade] = useState(true)
  const [minimapa, setMinimapa] = useState(false)
  const [ajudaAberta, setAjudaAberta] = useState(logico.tabelas.length === 0 && cabeAjudaLadoALado())
  const [mensagem, setMensagem] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasInternoRef.current
    if (!canvas) return
    const observador = new ResizeObserver(() => {
      if (!interagiuRef.current) void fitView({ padding: 0.2 })
    })
    observador.observe(canvas)
    return () => { observador.disconnect() }
  }, [fitView])

  const sql = useMemo(() => gerarSql(logico), [logico])
  const ligacoes = useMemo(() => ligacoesFk(logico), [logico])

  useEffect(() => {
    if (!mensagem) return
    const timer = setTimeout(() => { setMensagem(null) }, TEMPO_MENSAGEM_MS)
    return () => { clearTimeout(timer) }
  }, [mensagem])

  const selecionar = useCallback(
    (nova: SelecaoLogico | null) => {
      setSelecao(nova)
      if (nova?.tipo === 'tabela' || nova?.tipo === 'coluna') {
        const tabela = logico.tabelas.find((t) => t.id === (nova.tipo === 'tabela' ? nova.id : nova.tabelaId))
        if (!tabela) return
        const coluna = nova.tipo === 'coluna' ? tabela.colunas.find((c) => c.id === nova.colunaId) : undefined
        onSelecionar({
          tabela: normalizarIdentificador(tabela.nome),
          coluna: coluna ? normalizarIdentificador(coluna.nome) || null : null,
        })
      }
    },
    [logico, onSelecionar],
  )

  // Seleção que deixou de existir (desfazer, exclusão pelo painel) some sozinha.
  const selecaoValida = useMemo((): SelecaoLogico | null => {
    if (!selecao) return null
    switch (selecao.tipo) {
      case 'tabela':
        return logico.tabelas.some((t) => t.id === selecao.id) ? selecao : null
      case 'coluna':
        return logico.tabelas.some((t) => t.id === selecao.tabelaId && t.colunas.some((c) => c.id === selecao.colunaId))
          ? selecao
          : null
      case 'nota':
        return logico.notas.some((n) => n.id === selecao.id) ? selecao : null
      case 'ligacao':
        return ligacoes.some((l) => l.id === selecao.id) ? selecao : null
    }
  }, [selecao, logico, ligacoes])

  const nodes = useMemo((): NoLogico[] => {
    const idSelecionado =
      selecaoValida?.tipo === 'tabela' || selecaoValida?.tipo === 'nota'
        ? selecaoValida.id
        : selecaoValida?.tipo === 'coluna'
          ? selecaoValida.tabelaId
          : null
    const comMedida = (id: string): { measured?: { width: number; height: number } } => {
      const medida = medidas.get(id)
      return medida ? { measured: medida } : {}
    }
    return [
      ...logico.tabelas.map((tabela): TabelaNodeTipo => ({
        id: tabela.id,
        type: 'tabela',
        position: tabela.posicao,
        data: { tabela },
        selected: idSelecionado === tabela.id,
        ...comMedida(tabela.id),
      })),
      ...logico.notas.map((nota): NotaNodeTipo => ({
        id: nota.id,
        type: 'nota',
        position: nota.posicao,
        data: {
          texto: nota.texto,
          somenteLeitura,
          onTexto: (texto) => { onAplicar((l) => atualizarNota(l, nota.id, { texto }), `nota:${nota.id}`) },
          onEncerrar: historico.encerrarGesto,
        },
        selected: idSelecionado === nota.id,
        ...comMedida(nota.id),
      })),
    ]
  }, [logico, medidas, selecaoValida, somenteLeitura, onAplicar, historico.encerrarGesto])

  const edges = useMemo(
    (): FkEdgeTipo[] =>
      ligacoes.map((ligacao) => ({
        id: ligacao.id,
        type: 'fk',
        source: ligacao.tabelaReferenciadaId,
        target: ligacao.tabelaId,
        data: {
          cardinalidadeReferenciada: ligacao.cardinalidadeReferenciada,
          cardinalidadeReferenciadora: ligacao.cardinalidadeReferenciadora,
        },
        selected: selecaoValida?.tipo === 'ligacao' && selecaoValida.id === ligacao.id,
      })),
    [ligacoes, selecaoValida],
  )

  const onNodesChange = useCallback(
    (mudancas: NodeChange<NoLogico>[]) => {
      const novasMedidas: [string, { width: number; height: number }][] = []
      const movimentos: { id: string; posicao: Posicao }[] = []
      let fimDeArrasto = false

      for (const mudanca of mudancas) {
        if (mudanca.type === 'dimensions' && mudanca.dimensions) {
          novasMedidas.push([mudanca.id, mudanca.dimensions])
        } else if (mudanca.type === 'position') {
          if (mudanca.position && !somenteLeitura) movimentos.push({ id: mudanca.id, posicao: mudanca.position })
          if (mudanca.dragging === false) fimDeArrasto = true
        } else if (mudanca.type === 'select' && mudanca.selected) {
          const ehNota = logico.notas.some((nota) => nota.id === mudanca.id)
          selecionar(ehNota ? { tipo: 'nota', id: mudanca.id } : { tipo: 'tabela', id: mudanca.id })
        }
      }

      if (novasMedidas.length > 0) {
        setMedidas((atuais) => {
          const proximas = new Map(atuais)
          let mudou = false
          for (const [id, medida] of novasMedidas) {
            const atual = atuais.get(id)
            if (atual?.width !== medida.width || atual.height !== medida.height) {
              proximas.set(id, medida)
              mudou = true
            }
          }
          return mudou ? proximas : atuais
        })
      }
      if (movimentos.length > 0) {
        onAplicar(
          (atual) =>
            movimentos.reduce(
              (acc, { id, posicao }) =>
                acc.tabelas.some((t) => t.id === id)
                  ? moverTabela(acc, id, posicao)
                  : { ...acc, notas: acc.notas.map((n) => (n.id === id ? { ...n, posicao } : n)) },
              atual,
            ),
          `mover:${movimentos.map((m) => m.id).join(',')}`,
        )
      }
      if (fimDeArrasto) historico.encerrarGesto()
    },
    [logico.notas, onAplicar, historico, selecionar, somenteLeitura],
  )

  const onEdgesChange = useCallback(
    (mudancas: EdgeChange<FkEdgeTipo>[]) => {
      for (const mudanca of mudancas) {
        if (mudanca.type === 'select' && mudanca.selected) selecionar({ tipo: 'ligacao', id: mudanca.id })
      }
    },
    [selecionar],
  )

  const ligar = useCallback(
    (referenciadaId: string, tabelaId: string) => {
      if (somenteLeitura) return
      const ehTabela = (id: string): boolean => logico.tabelas.some((t) => t.id === id)
      if (!ehTabela(referenciadaId) || !ehTabela(tabelaId)) return
      const resultado = ligarTabelas(logico, referenciadaId, tabelaId)
      if (!resultado.ok) {
        setMensagem(resultado.erro)
        return
      }
      onAplicar(() => resultado.logico)
    },
    [logico, onAplicar, somenteLeitura],
  )

  // Soltar a ligação no corpo de uma tabela (e não exatamente numa alça) também liga.
  const onConnectEnd: OnConnectEnd = useCallback(
    (evento, estado) => {
      if (estado.isValid || !estado.fromNode) return
      const ponto = 'changedTouches' in evento ? evento.changedTouches[0] : evento
      if (!ponto) return
      const alvo = document.elementFromPoint(ponto.clientX, ponto.clientY)?.closest('.react-flow__node')
      const alvoId = alvo?.getAttribute('data-id')
      if (alvoId) ligar(estado.fromNode.id, alvoId)
    },
    [ligar],
  )

  const posicaoNoCentro = useCallback((): Posicao => {
    const area = areaRef.current?.getBoundingClientRect()
    if (!area) return { x: 0, y: 0 }
    const centro = screenToFlowPosition({ x: area.left + area.width / 2, y: area.top + area.height / 2 })
    const deslocamento = (logico.tabelas.length + logico.notas.length) % 5 * 24
    return { x: centro.x - 100 + deslocamento, y: centro.y - 40 + deslocamento }
  }, [screenToFlowPosition, logico.tabelas.length, logico.notas.length])

  const adicionar = useCallback(
    (tipo: ElementoPaleta, posicao: Posicao = posicaoNoCentro()) => {
      if (somenteLeitura) return
      if (tipo === 'tabela') {
        const resultado = adicionarTabela(logico, posicao)
        onAplicar(() => resultado.logico)
        selecionar({ tipo: 'tabela', id: resultado.tabelaId })
      } else {
        const resultado = adicionarNota(logico, posicao)
        onAplicar(() => resultado.logico)
        selecionar({ tipo: 'nota', id: resultado.notaId })
      }
    },
    [logico, onAplicar, posicaoNoCentro, selecionar, somenteLeitura],
  )

  const excluirSelecionado = useCallback(() => {
    if (somenteLeitura || !selecaoValida) return
    const alvo = selecaoValida
    onAplicar((atual) => {
      switch (alvo.tipo) {
        case 'tabela':
          return removerTabela(atual, alvo.id)
        case 'coluna':
          return removerColuna(atual, alvo.tabelaId, alvo.colunaId)
        case 'nota':
          return removerNota(atual, alvo.id)
        case 'ligacao': {
          const ligacao = ligacoesFk(atual).find((l) => l.id === alvo.id)
          return ligacao ? removerLigacao(atual, ligacao) : atual
        }
      }
    })
    setSelecao(alvo.tipo === 'coluna' ? { tipo: 'tabela', id: alvo.tabelaId } : null)
  }, [onAplicar, selecaoValida, somenteLeitura])

  const duplicarSelecionado = useCallback(() => {
    if (somenteLeitura || selecaoValida?.tipo !== 'tabela') return
    const resultado = duplicarTabela(logico, selecaoValida.id)
    if (!resultado) return
    onAplicar(() => resultado.logico)
    selecionar({ tipo: 'tabela', id: resultado.tabelaId })
  }, [logico, onAplicar, selecaoValida, selecionar, somenteLeitura])

  const onKeyDown = (evento: KeyboardEvent): void => {
    if (somenteLeitura || evento.target === null || ehCampoDeTexto(evento.target)) return
    const ctrl = evento.ctrlKey || evento.metaKey
    const tecla = evento.key.toLowerCase()
    if (evento.key === 'Delete' || evento.key === 'Backspace') {
      evento.preventDefault()
      excluirSelecionado()
    } else if (ctrl && tecla === 'z') {
      evento.preventDefault()
      if (evento.shiftKey) historico.refazer()
      else historico.desfazer()
    } else if (ctrl && tecla === 'y') {
      evento.preventDefault()
      historico.refazer()
    } else if (ctrl && tecla === 'd') {
      evento.preventDefault()
      duplicarSelecionado()
    } else if (evento.key === 'Escape') {
      setSelecao(null)
    }
  }

  // Atalhos só valem com o foco dentro do editor (não brigam com o Ctrl+Z do Monaco).
  // Listener nativo: o contêiner é um widget de teclado (role="application").
  const onKeyDownRef = useRef(onKeyDown)
  useEffect(() => {
    onKeyDownRef.current = onKeyDown
  })
  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    const ouvir = (evento: KeyboardEvent): void => { onKeyDownRef.current(evento) }
    area.addEventListener('keydown', ouvir)
    return () => { area.removeEventListener('keydown', ouvir) }
  }, [])

  const onDrop = (evento: DragEvent<HTMLDivElement>): void => {
    const tipo = evento.dataTransfer.getData(TIPO_ARRASTO_PALETA)
    if (tipo !== 'tabela' && tipo !== 'nota') return
    evento.preventDefault()
    adicionar(tipo, screenToFlowPosition({ x: evento.clientX, y: evento.clientY }))
  }

  const acoesContexto = useMemo(
    (): LogicoEditorAcoes => ({
      somenteLeitura,
      selecao: selecaoValida,
      selecionar,
      renomearTabela: (tabelaId, nome) => { onAplicar((l) => renomearTabela(l, tabelaId, nome), `tabela-nome:${tabelaId}`) },
      atualizarTextoNota: (notaId, texto) => { onAplicar((l) => atualizarNota(l, notaId, { texto }), `nota:${notaId}`) },
      encerrarGesto: historico.encerrarGesto,
      destaque,
    }),
    [somenteLeitura, selecaoValida, selecionar, onAplicar, historico.encerrarGesto, destaque],
  )

  const painelAberto = selecaoValida !== null || ajudaAberta

  return (
    <LogicoEditorContexto.Provider value={acoesContexto}>
      <div
        ref={areaRef}
        role="application"
        aria-label="Editor do modelo lógico"
        tabIndex={-1}
        className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md border border-neutral-300 bg-surface outline-none"
      >
        <BarraFerramentas
          podeDesfazer={historico.podeDesfazer}
          podeRefazer={historico.podeRefazer}
          onDesfazer={historico.desfazer}
          onRefazer={historico.refazer}
          podeDuplicar={selecaoValida?.tipo === 'tabela'}
          podeExcluir={selecaoValida !== null}
          onDuplicar={duplicarSelecionado}
          onExcluir={excluirSelecionado}
          grade={grade}
          onAlternarGrade={() => { setGrade((atual) => !atual) }}
          somenteLeitura={somenteLeitura}
          extras={
            <>
              <BotaoIcone rotulo="Minimapa" ativo={minimapa} onClick={() => { setMinimapa((atual) => !atual) }}>▣</BotaoIcone>
              <BotaoIcone rotulo="Ajuda" ativo={ajudaAberta} onClick={() => { setAjudaAberta((atual) => !atual) }}>?</BotaoIcone>
            </>
          }
          direita={barraDireita}
        />
        <div className="flex min-h-0 flex-1">
          {somenteLeitura ? null : <Paleta itens={ITENS_PALETA} onAdicionar={(tipo) => { adicionar(tipo) }} />}
          <div
            ref={(elemento) => {
              canvasInternoRef.current = elemento
              if (canvasRef) canvasRef.current = elemento
            }}
            className="relative min-w-0 flex-1"
            onDragOver={(evento) => { evento.preventDefault() }}
            onDrop={onDrop}
          >
            <ReactFlow<NoLogico, FkEdgeTipo>
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={(conexao) => { ligar(conexao.source, conexao.target) }}
              onConnectEnd={onConnectEnd}
              onPaneClick={() => {
                setSelecao(null)
                areaRef.current?.focus()
              }}
              onNodeClick={() => { areaRef.current?.focus({ preventScroll: true }) }}
              onNodeDragStart={() => { interagiuRef.current = true }}
              onMoveStart={(evento) => {
                // Evento null = movimento programático (fitView); só conta o gesto do usuário.
                if (evento) interagiuRef.current = true
              }}
              connectionMode={ConnectionMode.Loose}
              deleteKeyCode={null}
              selectionKeyCode={null}
              multiSelectionKeyCode={null}
              nodesDraggable={!somenteLeitura}
              nodesConnectable={!somenteLeitura}
              snapToGrid={grade}
              snapGrid={GRADE}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.3}
            >
              {grade ? <Background variant={BackgroundVariant.Dots} gap={GRADE} /> : null}
              {minimapa ? <MiniMap pannable zoomable style={{ width: 140, height: 90 }} /> : null}
            </ReactFlow>
            {mensagem ? (
              <p role="alert" className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-white shadow">
                {mensagem}
              </p>
            ) : null}
            {painelAberto ? (
              <div className="absolute inset-y-0 right-0 z-10 flex bg-surface shadow-lg">
                <PainelPropriedadesLogico
                  logico={logico}
                  selecao={selecaoValida}
                  avisos={sql.avisos}
                  somenteLeitura={somenteLeitura}
                  onAplicar={onAplicar}
                  onEncerrarGesto={historico.encerrarGesto}
                  onSelecionar={selecionar}
                />
                <button
                  type="button"
                  aria-label="Fechar painel de propriedades"
                  className="absolute right-1 top-1 rounded p-1 text-xs text-neutral-500 hover:bg-neutral-100"
                  onClick={() => {
                    setSelecao(null)
                    setAjudaAberta(false)
                  }}
                >
                  ✕
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </LogicoEditorContexto.Provider>
  )
}

/** Editor do modelo lógico (tabelas e chaves estrangeiras). Estado e histórico ficam com quem usa. */
export const LogicoEditor = (props: LogicoEditorProps): ReactNode => (
  <ReactFlowProvider>
    <LogicoEditorInterno {...props} />
  </ReactFlowProvider>
)

export default LogicoEditor
