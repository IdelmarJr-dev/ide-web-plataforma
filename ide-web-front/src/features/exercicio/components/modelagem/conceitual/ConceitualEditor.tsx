import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, ReactNode, RefObject } from 'react'
import { Background, BackgroundVariant, ConnectionMode, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import type { EdgeChange, EdgeTypes, NodeChange, NodeTypes, OnConnectEnd } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ModeloConceitual, VisaoAtributos } from '../../../modelagem/documento'
import { ConceitualEditorContexto } from '../../../modelagem/conceitual/editorContexto'
import type { ConceitualEditorAcoes, SelecaoConceitual } from '../../../modelagem/conceitual/editorContexto'
import {
  adicionarAtributo,
  adicionarEntidade,
  adicionarEspecializacao,
  adicionarNota,
  adicionarRelacionamento,
  atualizarTextoNota,
  atributosDe,
  atributosEmArvore,
  criarFilhoEspecializacao,
  criarParticipacao,
  duplicarEntidade,
  moverElemento,
  removerElemento,
  removerLigacao,
  renomearElemento,
} from '../../../modelagem/conceitual/operacoes'
import type {
  AtributoElemento,
  EntidadeElemento,
  EspecializacaoElemento,
  NotaConceitualElemento,
  Posicao,
  RelacionamentoElemento,
} from '../../../modelagem/conceitual/operacoes'
import { BarraFerramentas, BotaoIcone } from '../BarraFerramentas'
import { NotaNode } from '../NotaNode'
import type { NotaNodeTipo } from '../NotaNode'
import { Paleta, TIPO_ARRASTO_PALETA } from '../Paleta'
import type { ItemPaleta } from '../Paleta'
import { AtributoNode } from './AtributoNode'
import type { AtributoNodeTipo } from './AtributoNode'
import { EntidadeNode } from './EntidadeNode'
import type { EntidadeNodeTipo } from './EntidadeNode'
import { EspecializacaoNode } from './EspecializacaoNode'
import type { EspecializacaoNodeTipo } from './EspecializacaoNode'
import { LinhaEdge } from './LinhaEdge'
import type { LinhaEdgeTipo } from './LinhaEdge'
import { ParticipacaoEdge } from './ParticipacaoEdge'
import type { ParticipacaoEdgeTipo } from './ParticipacaoEdge'
import { PainelPropriedadesConceitual } from './PainelPropriedadesConceitual'
import { RelacionamentoNode } from './RelacionamentoNode'
import type { RelacionamentoNodeTipo } from './RelacionamentoNode'

const NODE_TYPES: NodeTypes = {
  entidade: EntidadeNode,
  relacionamento: RelacionamentoNode,
  atributo: AtributoNode,
  especializacao: EspecializacaoNode,
  nota: NotaNode,
}
const EDGE_TYPES: EdgeTypes = { participacao: ParticipacaoEdge, linha: LinhaEdge }
const GRADE: [number, number] = [16, 16]
const TEMPO_MENSAGEM_MS = 4000
const CURVATURA_BASE = 0.25
const CURVATURA_PASSO = 0.35
const RAIO_LEQUE_ATRIBUTO = 130

type NoConceitual = EntidadeNodeTipo | RelacionamentoNodeTipo | AtributoNodeTipo | EspecializacaoNodeTipo | NotaNodeTipo
type ArestaConceitual = ParticipacaoEdgeTipo | LinhaEdgeTipo
type ElementoPaleta = 'entidade' | 'relacionamento' | 'atributo' | 'especializacao' | 'nota'
// Precisam de um pai: a paleta exige que sejam soltos em cima de outro elemento.
const PALETA_COM_PAI: readonly ElementoPaleta[] = ['atributo', 'especializacao']

const ITENS_PALETA: ItemPaleta<ElementoPaleta>[] = [
  { tipo: 'entidade', rotulo: 'Entidade', icone: <span className="inline-block h-4 w-6 rounded-sm border-2 border-neutral-700" /> },
  {
    tipo: 'relacionamento',
    rotulo: 'Relação',
    icone: <span className="inline-block h-4 w-4 rotate-45 border-2 border-neutral-700" />,
  },
  { tipo: 'atributo', rotulo: 'Atributo', icone: <span className="inline-block h-4 w-6 rounded-full border-2 border-neutral-500" /> },
  {
    tipo: 'especializacao',
    rotulo: 'Especial.',
    icone: (
      <svg viewBox="0 0 24 18" className="h-4 w-6" aria-hidden="true">
        <polygon points="12,2 22,16 2,16" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  { tipo: 'nota', rotulo: 'Nota', icone: <span className="inline-block h-4 w-5 rounded-sm border border-amber-400 bg-amber-100" /> },
]

export interface ControleHistoricoConceitual {
  podeDesfazer: boolean
  podeRefazer: boolean
  desfazer: () => void
  refazer: () => void
  encerrarGesto: () => void
}

export interface ConceitualEditorProps {
  conceitual: ModeloConceitual
  onAplicar: (atualizar: (conceitual: ModeloConceitual) => ModeloConceitual, chave?: string) => void
  historico: ControleHistoricoConceitual
  somenteLeitura?: boolean
  barraDireita?: ReactNode
  canvasRef?: RefObject<HTMLDivElement | null> | undefined
}

function ehCampoDeTexto(alvo: EventTarget): boolean {
  return alvo instanceof HTMLElement && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))
}

// Em tela estreita o painel cobre o desenho inteiro: a ajuda só abre sozinha quando há
// espaço pros dois (o botão "?" continua abrindo em qualquer largura).
const LARGURA_MINIMA_PARA_AJUDA = 1024

function cabeAjudaLadoALado(): boolean {
  return typeof window === 'undefined' || window.innerWidth >= LARGURA_MINIMA_PARA_AJUDA
}

const ConceitualEditorInterno = ({
  conceitual,
  onAplicar,
  historico,
  somenteLeitura = false,
  barraDireita,
  canvasRef,
}: ConceitualEditorProps): ReactNode => {
  const { screenToFlowPosition, fitView } = useReactFlow()
  const areaRef = useRef<HTMLDivElement>(null)
  const canvasInternoRef = useRef<HTMLDivElement | null>(null)
  const interagiuRef = useRef(false)
  const [selecao, setSelecao] = useState<SelecaoConceitual | null>(null)
  const [medidas, setMedidas] = useState<Map<string, { width: number; height: number }>>(new Map())
  const [grade, setGrade] = useState(true)
  const [minimapa, setMinimapa] = useState(false)
  const [ajudaAberta, setAjudaAberta] = useState(conceitual.elementos.length === 0 && cabeAjudaLadoALado())
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

  useEffect(() => {
    if (!mensagem) return
    const timer = setTimeout(() => { setMensagem(null) }, TEMPO_MENSAGEM_MS)
    return () => { clearTimeout(timer) }
  }, [mensagem])

  const selecionar = useCallback((nova: SelecaoConceitual | null) => { setSelecao(nova) }, [])

  const selecaoValida = useMemo((): SelecaoConceitual | null => {
    if (!selecao) return null
    if (selecao.tipo === 'participacao' || selecao.tipo === 'filho') {
      const esperado = selecao.tipo === 'participacao' ? 'participacao' : 'filho_especializacao'
      return conceitual.ligacoes.some((ligacao) => ligacao.id === selecao.id && ligacao.tipo === esperado) ? selecao : null
    }
    return conceitual.elementos.some((elemento) => elemento.id === selecao.id && elemento.tipo === selecao.tipo) ? selecao : null
  }, [selecao, conceitual])

  const nodes = useMemo((): NoConceitual[] => {
    const ehLigacao = selecaoValida?.tipo === 'participacao' || selecaoValida?.tipo === 'filho'
    const idSelecionado = selecaoValida && !ehLigacao ? selecaoValida.id : null
    const comMedida = (id: string): { measured?: { width: number; height: number } } => {
      const medida = medidas.get(id)
      return medida ? { measured: medida } : {}
    }
    const entidades = conceitual.elementos.filter((e): e is EntidadeElemento => e.tipo === 'entidade')
    const relacionamentos = conceitual.elementos.filter((e): e is RelacionamentoElemento => e.tipo === 'relacionamento')
    const notas = conceitual.elementos.filter((e): e is NotaConceitualElemento => e.tipo === 'nota')
    const especializacoes = conceitual.elementos.filter((e): e is EspecializacaoElemento => e.tipo === 'especializacao')
    const atributosVisiveis = conceitual.visaoAtributos === 'circulos' ? conceitual.elementos.filter((e): e is AtributoElemento => e.tipo === 'atributo') : []

    return [
      ...entidades.map((entidade): EntidadeNodeTipo => ({
        id: entidade.id,
        type: 'entidade',
        position: entidade.posicao,
        data: { entidade, atributos: atributosEmArvore(conceitual, entidade.id), visaoAtributos: conceitual.visaoAtributos },
        selected: idSelecionado === entidade.id,
        ...comMedida(entidade.id),
      })),
      ...relacionamentos.map((relacionamento): RelacionamentoNodeTipo => ({
        id: relacionamento.id,
        type: 'relacionamento',
        position: relacionamento.posicao,
        data: { relacionamento, atributos: atributosEmArvore(conceitual, relacionamento.id), visaoAtributos: conceitual.visaoAtributos },
        selected: idSelecionado === relacionamento.id,
        ...comMedida(relacionamento.id),
      })),
      ...atributosVisiveis.map((atributo): AtributoNodeTipo => ({
        id: atributo.id,
        type: 'atributo',
        position: atributo.posicao,
        data: { atributo, composto: atributosDe(conceitual, atributo.id).length > 0 },
        selected: idSelecionado === atributo.id,
        ...comMedida(atributo.id),
      })),
      ...especializacoes.map((especializacao): EspecializacaoNodeTipo => ({
        id: especializacao.id,
        type: 'especializacao',
        position: especializacao.posicao,
        data: { especializacao },
        selected: idSelecionado === especializacao.id,
        ...comMedida(especializacao.id),
      })),
      ...notas.map((nota): NotaNodeTipo => ({
        id: nota.id,
        type: 'nota',
        position: nota.posicao,
        data: {
          texto: nota.texto,
          somenteLeitura,
          onTexto: (texto) => { onAplicar((c) => atualizarTextoNota(c, nota.id, texto), `nota:${nota.id}`) },
          onEncerrar: historico.encerrarGesto,
        },
        selected: idSelecionado === nota.id,
        ...comMedida(nota.id),
      })),
    ]
  }, [conceitual, medidas, selecaoValida, somenteLeitura, onAplicar, historico.encerrarGesto])

  const edges = useMemo((): ArestaConceitual[] => {
    const contagemPares = new Map<string, number>()
    const participacaoEdges: ParticipacaoEdgeTipo[] = []
    for (const ligacao of conceitual.ligacoes) {
      if (ligacao.tipo !== 'participacao') continue
      const chave = `${ligacao.relacionamentoId}|${ligacao.entidadeId}`
      const indice = contagemPares.get(chave) ?? 0
      contagemPares.set(chave, indice + 1)
      participacaoEdges.push({
        id: ligacao.id,
        type: 'participacao',
        source: ligacao.relacionamentoId,
        target: ligacao.entidadeId,
        data: { min: ligacao.min, max: ligacao.max, papel: ligacao.papel, curvatura: CURVATURA_BASE + indice * CURVATURA_PASSO },
        selected: selecaoValida?.tipo === 'participacao' && selecaoValida.id === ligacao.id,
      })
    }
    const existe = new Set(conceitual.elementos.map((e) => e.id))
    // Na visão "lista" os atributos não têm nó; a linha até o pai só existe em círculos.
    const paisComNo = new Set(
      conceitual.elementos
        .filter((e) => e.tipo === 'entidade' || e.tipo === 'relacionamento' || (e.tipo === 'atributo' && conceitual.visaoAtributos === 'circulos'))
        .map((e) => e.id),
    )
    const atributoEdges: LinhaEdgeTipo[] =
      conceitual.visaoAtributos === 'circulos'
        ? conceitual.elementos
            .filter((e): e is AtributoElemento => e.tipo === 'atributo' && paisComNo.has(e.paiId))
            .map((atributo) => ({ id: `linha:${atributo.id}`, type: 'linha', source: atributo.paiId, target: atributo.id, data: {}, selectable: false }))
        : []

    const especializacaoEdges: LinhaEdgeTipo[] = conceitual.elementos
      .filter((e): e is EspecializacaoElemento => e.tipo === 'especializacao' && existe.has(e.paiId))
      .map((especializacao) => ({
        id: `linha:${especializacao.id}`,
        type: 'linha',
        source: especializacao.paiId,
        target: especializacao.id,
        data: {},
        selectable: false,
      }))

    const filhoEdges: LinhaEdgeTipo[] = conceitual.ligacoes
      .filter((ligacao) => ligacao.tipo === 'filho_especializacao' && existe.has(ligacao.especializacaoId) && existe.has(ligacao.entidadeId))
      .map((ligacao) => ({
        id: ligacao.id,
        type: 'linha',
        source: ligacao.tipo === 'filho_especializacao' ? ligacao.especializacaoId : '',
        target: ligacao.tipo === 'filho_especializacao' ? ligacao.entidadeId : '',
        data: {},
        selected: selecaoValida?.tipo === 'filho' && selecaoValida.id === ligacao.id,
      }))

    return [...participacaoEdges, ...atributoEdges, ...especializacaoEdges, ...filhoEdges]
  }, [conceitual, selecaoValida])

  const onNodesChange = useCallback(
    (mudancas: NodeChange<NoConceitual>[]) => {
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
          const elemento = conceitual.elementos.find((e) => e.id === mudanca.id)
          if (elemento) selecionar({ tipo: elemento.tipo, id: elemento.id })
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
          (atual) => movimentos.reduce((acc, { id, posicao }) => moverElemento(acc, id, posicao), atual),
          `mover:${movimentos.map((m) => m.id).join(',')}`,
        )
      }
      if (fimDeArrasto) historico.encerrarGesto()
    },
    [conceitual.elementos, onAplicar, historico, selecionar, somenteLeitura],
  )

  const onEdgesChange = useCallback(
    (mudancas: EdgeChange<ArestaConceitual>[]) => {
      for (const mudanca of mudancas) {
        if (mudanca.type !== 'select' || !mudanca.selected) continue
        const ligacao = conceitual.ligacoes.find((existente) => existente.id === mudanca.id)
        if (ligacao) selecionar({ tipo: ligacao.tipo === 'participacao' ? 'participacao' : 'filho', id: ligacao.id })
      }
    },
    [conceitual.ligacoes, selecionar],
  )

  const ligar = useCallback(
    (idA: string, idB: string) => {
      if (somenteLeitura) return
      const a = conceitual.elementos.find((e) => e.id === idA)
      const b = conceitual.elementos.find((e) => e.id === idB)
      if (!a || !b || a.id === b.id) return

      // Especialização → entidade especializada.
      const especializacao = a.tipo === 'especializacao' ? a : b.tipo === 'especializacao' ? b : null
      if (especializacao) {
        const filha = especializacao.id === a.id ? b : a
        const resultado = criarFilhoEspecializacao(conceitual, especializacao.id, filha.id)
        if (!resultado.ok) {
          setMensagem(resultado.erro)
          return
        }
        onAplicar(() => resultado.conceitual)
        return
      }

      // Relacionamento → entidade (ou entidade associativa, que participa como entidade).
      const podeParticipar = (elemento: typeof a): boolean =>
        elemento.tipo === 'entidade' || (elemento.tipo === 'relacionamento' && elemento.associativa)
      const par =
        a.tipo === 'relacionamento' && podeParticipar(b)
          ? { relacionamento: a, participante: b }
          : b.tipo === 'relacionamento' && podeParticipar(a)
            ? { relacionamento: b, participante: a }
            : null
      if (!par) {
        setMensagem('Ligue um relacionamento a uma entidade.')
        return
      }
      const resultado = criarParticipacao(conceitual, par.relacionamento.id, par.participante.id)
      if (!resultado.ok) {
        setMensagem(resultado.erro)
        return
      }
      onAplicar(() => resultado.conceitual)
    },
    [conceitual, onAplicar, somenteLeitura],
  )

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
    const deslocamento = (conceitual.elementos.length % 5) * 24
    return { x: centro.x - 100 + deslocamento, y: centro.y - 40 + deslocamento }
  }, [screenToFlowPosition, conceitual.elementos.length])

  const posicaoProximaDoPai = useCallback(
    (paiId: string): Posicao => {
      const pai = conceitual.elementos.find((e) => e.id === paiId)
      if (!pai) return posicaoNoCentro()
      const quantidade = atributosDe(conceitual, paiId).length
      const angulo = ((quantidade % 6) * 60 * Math.PI) / 180
      return { x: pai.posicao.x + Math.cos(angulo) * RAIO_LEQUE_ATRIBUTO, y: pai.posicao.y + 70 + Math.sin(angulo) * RAIO_LEQUE_ATRIBUTO }
    },
    [conceitual, posicaoNoCentro],
  )

  const adicionarAtributoEm = useCallback(
    (paiId: string, posicao?: Posicao) => {
      const resultado = adicionarAtributo(conceitual, paiId, posicao ?? posicaoProximaDoPai(paiId))
      if (!resultado) {
        setMensagem('Atributos só podem ser adicionados a entidades ou relacionamentos.')
        return
      }
      onAplicar(() => resultado.conceitual)
      selecionar({ tipo: 'atributo', id: resultado.id })
    },
    [conceitual, onAplicar, posicaoProximaDoPai, selecionar],
  )

  const adicionarEspecializacaoEm = useCallback(
    (paiId: string, posicao?: Posicao) => {
      const base = conceitual.elementos.find((e) => e.id === paiId)
      const alvo = posicao ?? (base ? { x: base.posicao.x + 20, y: base.posicao.y + 160 } : posicaoNoCentro())
      const resultado = adicionarEspecializacao(conceitual, paiId, alvo)
      if (!resultado) {
        setMensagem('A especialização precisa pender de uma entidade genérica.')
        return
      }
      onAplicar(() => resultado.conceitual)
      selecionar({ tipo: 'especializacao', id: resultado.id })
    },
    [conceitual, onAplicar, posicaoNoCentro, selecionar],
  )

  const adicionar = useCallback(
    (tipo: ElementoPaleta) => {
      if (somenteLeitura) return
      if (tipo === 'atributo' || tipo === 'especializacao') {
        const selecionadoId =
          selecaoValida?.tipo === 'entidade' || selecaoValida?.tipo === 'relacionamento' ? selecaoValida.id : null
        if (!selecionadoId) {
          setMensagem(
            tipo === 'atributo'
              ? 'Selecione uma entidade ou relacionamento antes de adicionar um atributo.'
              : 'Selecione a entidade genérica antes de adicionar uma especialização.',
          )
          return
        }
        if (tipo === 'atributo') adicionarAtributoEm(selecionadoId)
        else adicionarEspecializacaoEm(selecionadoId)
        return
      }
      const posicao = posicaoNoCentro()
      if (tipo === 'entidade') {
        const resultado = adicionarEntidade(conceitual, posicao)
        onAplicar(() => resultado.conceitual)
        selecionar({ tipo: 'entidade', id: resultado.id })
      } else if (tipo === 'relacionamento') {
        const resultado = adicionarRelacionamento(conceitual, posicao)
        onAplicar(() => resultado.conceitual)
        selecionar({ tipo: 'relacionamento', id: resultado.id })
      } else {
        const resultado = adicionarNota(conceitual, posicao)
        onAplicar(() => resultado.conceitual)
        selecionar({ tipo: 'nota', id: resultado.id })
      }
    },
    [adicionarAtributoEm, adicionarEspecializacaoEm, conceitual, onAplicar, posicaoNoCentro, selecaoValida, selecionar, somenteLeitura],
  )

  const excluirSelecionado = useCallback(() => {
    if (somenteLeitura || !selecaoValida) return
    const alvo = selecaoValida
    const ehLigacao = alvo.tipo === 'participacao' || alvo.tipo === 'filho'
    onAplicar((atual) => (ehLigacao ? removerLigacao(atual, alvo.id) : removerElemento(atual, alvo.id)))
    setSelecao(null)
  }, [onAplicar, selecaoValida, somenteLeitura])

  const duplicarSelecionado = useCallback(() => {
    if (somenteLeitura || selecaoValida?.tipo !== 'entidade') return
    const resultado = duplicarEntidade(conceitual, selecaoValida.id)
    if (!resultado) return
    onAplicar(() => resultado.conceitual)
    selecionar({ tipo: 'entidade', id: resultado.id })
  }, [conceitual, onAplicar, selecaoValida, selecionar, somenteLeitura])

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
    if (tipo !== 'entidade' && tipo !== 'relacionamento' && tipo !== 'nota' && tipo !== 'atributo' && tipo !== 'especializacao') return
    evento.preventDefault()
    const posicao = screenToFlowPosition({ x: evento.clientX, y: evento.clientY })

    if (PALETA_COM_PAI.includes(tipo)) {
      const alvo = document.elementFromPoint(evento.clientX, evento.clientY)?.closest('.react-flow__node')
      const alvoId = alvo?.getAttribute('data-id')
      const pai = conceitual.elementos.find((e) => e.id === alvoId)
      if (tipo === 'especializacao') {
        if (pai?.tipo !== 'entidade') {
          setMensagem('Solte a especialização sobre a entidade genérica.')
          return
        }
        adicionarEspecializacaoEm(pai.id, posicao)
        return
      }
      if (pai?.tipo !== 'entidade' && pai?.tipo !== 'relacionamento' && pai?.tipo !== 'atributo') {
        setMensagem('Solte o atributo sobre uma entidade, relacionamento ou atributo.')
        return
      }
      adicionarAtributoEm(pai.id, posicao)
      return
    }

    if (tipo === 'entidade') {
      const resultado = adicionarEntidade(conceitual, posicao)
      onAplicar(() => resultado.conceitual)
      selecionar({ tipo: 'entidade', id: resultado.id })
    } else if (tipo === 'relacionamento') {
      const resultado = adicionarRelacionamento(conceitual, posicao)
      onAplicar(() => resultado.conceitual)
      selecionar({ tipo: 'relacionamento', id: resultado.id })
    } else {
      const resultado = adicionarNota(conceitual, posicao)
      onAplicar(() => resultado.conceitual)
      selecionar({ tipo: 'nota', id: resultado.id })
    }
  }

  const alternarVisaoAtributos = useCallback(
    (visao: VisaoAtributos) => { onAplicar((c) => (c.visaoAtributos === visao ? c : { ...c, visaoAtributos: visao })) },
    [onAplicar],
  )

  const acoesContexto = useMemo(
    (): ConceitualEditorAcoes => ({
      somenteLeitura,
      selecao: selecaoValida,
      selecionar,
      renomearElemento: (id, nome) => { onAplicar((c) => renomearElemento(c, id, nome), `nome:${id}`) },
      atualizarTextoNota: (id, texto) => { onAplicar((c) => atualizarTextoNota(c, id, texto), `nota:${id}`) },
      encerrarGesto: historico.encerrarGesto,
    }),
    [somenteLeitura, selecaoValida, selecionar, onAplicar, historico.encerrarGesto],
  )

  const painelAberto = selecaoValida !== null || ajudaAberta

  return (
    <ConceitualEditorContexto.Provider value={acoesContexto}>
      <div
        ref={areaRef}
        role="application"
        aria-label="Editor do modelo conceitual"
        tabIndex={-1}
        className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md border border-neutral-300 bg-surface outline-none"
      >
        <BarraFerramentas
          podeDesfazer={historico.podeDesfazer}
          podeRefazer={historico.podeRefazer}
          onDesfazer={historico.desfazer}
          onRefazer={historico.refazer}
          podeDuplicar={selecaoValida?.tipo === 'entidade'}
          podeExcluir={selecaoValida !== null}
          onDuplicar={duplicarSelecionado}
          onExcluir={excluirSelecionado}
          grade={grade}
          onAlternarGrade={() => { setGrade((atual) => !atual) }}
          somenteLeitura={somenteLeitura}
          extras={
            <>
              <BotaoIcone
                rotulo="Atributos em círculos"
                ativo={conceitual.visaoAtributos === 'circulos'}
                onClick={() => { alternarVisaoAtributos('circulos') }}
              >
                ○
              </BotaoIcone>
              <BotaoIcone rotulo="Atributos em lista" ativo={conceitual.visaoAtributos === 'lista'} onClick={() => { alternarVisaoAtributos('lista') }}>
                ☰
              </BotaoIcone>
              <BotaoIcone rotulo="Minimapa" ativo={minimapa} onClick={() => { setMinimapa((atual) => !atual) }}>▣</BotaoIcone>
              <BotaoIcone rotulo="Ajuda" ativo={ajudaAberta} onClick={() => { setAjudaAberta((atual) => !atual) }}>?</BotaoIcone>
            </>
          }
          direita={barraDireita}
        />
        <div className="flex min-h-0 flex-1">
          {somenteLeitura ? null : <Paleta itens={ITENS_PALETA} onAdicionar={adicionar} />}
          <div
            ref={(elemento) => {
              canvasInternoRef.current = elemento
              if (canvasRef) canvasRef.current = elemento
            }}
            className="relative min-w-0 flex-1"
            onDragOver={(evento) => { evento.preventDefault() }}
            onDrop={onDrop}
          >
            <ReactFlow<NoConceitual, ArestaConceitual>
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={(conexao) => { if (conexao.source && conexao.target) ligar(conexao.source, conexao.target) }}
              onConnectEnd={onConnectEnd}
              onPaneClick={() => {
                setSelecao(null)
                areaRef.current?.focus()
              }}
              onNodeClick={() => { areaRef.current?.focus({ preventScroll: true }) }}
              onNodeDragStart={() => { interagiuRef.current = true }}
              onMoveStart={(evento) => {
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
                <PainelPropriedadesConceitual
                  conceitual={conceitual}
                  selecao={selecaoValida}
                  somenteLeitura={somenteLeitura}
                  onAplicar={onAplicar}
                  onEncerrarGesto={historico.encerrarGesto}
                  onSelecionar={selecionar}
                  onAdicionarAtributo={adicionarAtributoEm}
                  onAdicionarEspecializacao={adicionarEspecializacaoEm}
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
    </ConceitualEditorContexto.Provider>
  )
}

/** Editor do modelo conceitual (notação de Chen). Estado e histórico ficam com quem usa. */
export const ConceitualEditor = (props: ConceitualEditorProps): ReactNode => (
  <ReactFlowProvider>
    <ConceitualEditorInterno {...props} />
  </ReactFlowProvider>
)

export default ConceitualEditor
