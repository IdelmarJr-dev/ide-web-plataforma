import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import * as monaco from 'monaco-editor'
import Editor, { loader } from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import { PedirDicaButton } from '~features/dica-ia'
import type { EstadoDica } from '~features/dica-ia'
import { mascararStringsEComentarios } from '../modelagem/sincronizacao'
import type { Intervalo } from '../modelagem/sincronizacao'

// Usa o monaco-editor empacotado localmente em vez do carregador AMD via CDN
// (padrão do @monaco-editor/react) — mantém o editor funcionando 100% self-hosted.
loader.config({ monaco })

const CLASSE_DESTAQUE = 'mer-sync-destaque'

interface SQLEditorProps {
  exercicioId: string
  value: string
  onChange: (value: string) => void
  // Diagrama atual do aluno, enviado junto na dica quando o exercício também tem MER.
  estadoMer?: unknown
  // Sincronização MER ↔ SQL: trechos a destacar e posição do cursor (offset no texto).
  destaques?: Intervalo[]
  onCursorChange?: (offset: number) => void
}

/**
 * Editor SQL (Monaco). Execução real acontece no sandbox — ver SandboxPainel,
 * renderizado ao lado deste editor em ExercicioPage. Dica de IA (ver
 * docs/decisions/fase3-dicas-ia.md) usa o texto atual do editor, mesmo não salvo.
 */
export const SQLEditor = ({
  exercicioId,
  value,
  onChange,
  estadoMer,
  destaques = [],
  onCursorChange,
}: SQLEditorProps): ReactNode => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const decoracoesRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const onCursorChangeRef = useRef(onCursorChange)

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange
  }, [onCursorChange])

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
    decoracoesRef.current = editor.createDecorationsCollection()
    editor.onDidChangeCursorPosition((evento) => {
      const model = editor.getModel()
      if (model) onCursorChangeRef.current?.(model.getOffsetAt(evento.position))
    })
  }

  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (!model || !decoracoesRef.current) return
    decoracoesRef.current.set(
      destaques.map(({ inicio, fim }) => ({
        range: monaco.Range.fromPositions(model.getPositionAt(inicio), model.getPositionAt(fim)),
        options: { inlineClassName: CLASSE_DESTAQUE },
      })),
    )
  }, [destaques, value])

  const estado: EstadoDica = { estadoSql: value, ...(estadoMer === undefined ? {} : { estadoMer }) }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-neutral-300 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 px-2 py-1">
        <span className="text-sm font-medium text-neutral-800">Consulta SQL</span>
        <div className="ml-auto">
          <PedirDicaButton
            exercicioId={exercicioId}
            contexto="sql"
            estado={estado}
            semConteudo={mascararStringsEComentarios(value).trim().length === 0}
          />
        </div>
      </div>
      {/* `nokey`: no Chrome o Monaco recebe texto por uma div (EditContext), não por textarea,
          e o React Flow do modelo ao lado engoliria a tecla Espaço (atalho de pan) sem essa classe. */}
      <div className="nokey min-h-0 flex-1">
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={value}
          onChange={(newValue) => { onChange(newValue ?? '') }}
          onMount={handleMount}
          options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false }}
        />
      </div>
    </div>
  )
}

export default SQLEditor
