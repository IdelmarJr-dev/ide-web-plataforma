import { useCallback, useEffect, useMemo } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PedirDicaButton } from '~features/dica-ia'
import type { CapturarModelos } from '../../modelagem/captura'
import type { DocumentoModelagem, ModoModelagem } from '../../modelagem/documento'
import { documentoTemConteudo, parseDocumento } from '../../modelagem/documento'
import { modoDoExercicio } from '../../modelagem/modos'
import type { Selecao } from '../../modelagem/sincronizacao'
import { useAutosaveModelagem } from '../../modelagem/useAutosaveModelagem'
import { useDocumentoEditavel } from '../../modelagem/useDocumentoEditavel'
import { TelaCheia } from './TelaCheia'
import { exercicioService } from '../../services/exercicioService'
import { EditorModelagem } from './EditorModelagem'
import { IndicadorSalvamento } from './IndicadorSalvamento'

interface ModelagemCanvasProps {
  exercicioId: string
  modoExercicio: ModoModelagem
  capturaRef?: RefObject<CapturarModelos | null> | undefined
  // Documento atual repassado pra ExercicioPage (SQL do modelo, sincronização, dica de SQL).
  onDocumentoChange?: (documento: DocumentoModelagem) => void
  destaque?: Selecao | null
  onSelecionar?: (selecao: Selecao) => void
  // Consulta atual, enviada junto na dica quando o exercício também tem SQL.
  sqlAtual?: string
}

/**
 * Modelagem do aluno: carrega de GET /exercicios/:id/diagrama e salva sozinha em PUT
 * — ver docs/decisions/fase7-modelagem-conceitual-logica.md.
 */
export const ModelagemCanvas = ({ exercicioId, ...resto }: ModelagemCanvasProps): ReactNode => {
  const diagramaQuery = useQuery({
    queryKey: ['exercicios', exercicioId, 'diagrama'],
    queryFn: () => exercicioService.getDiagrama(exercicioId),
  })

  const inicial = useMemo(() => parseDocumento(diagramaQuery.data?.conteudoJson), [diagramaQuery.data])

  if (diagramaQuery.isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-md border border-neutral-300 text-sm text-neutral-600">
        Carregando modelo…
      </div>
    )
  }

  if (diagramaQuery.isError) {
    return (
      <p role="alert" className="rounded-md border border-danger-500 p-3 text-sm text-danger-600">
        Não foi possível carregar seu modelo. Recarregue a página antes de continuar.
      </p>
    )
  }

  // `key`: trocar de exercício remonta o editor com o histórico zerado.
  return (
    <TelaCheia>
      <ModelagemAluno key={exercicioId} exercicioId={exercicioId} inicial={inicial} {...resto} />
    </TelaCheia>
  )
}

interface ModelagemAlunoProps extends Omit<ModelagemCanvasProps, 'exercicioId'> {
  exercicioId: string
  inicial: DocumentoModelagem
}

const ModelagemAluno = ({
  exercicioId,
  inicial,
  modoExercicio,
  capturaRef,
  onDocumentoChange,
  destaque,
  onSelecionar,
  sqlAtual,
}: ModelagemAlunoProps): ReactNode => {
  const editavel = useDocumentoEditavel(inicial)
  const { documento } = editavel

  const salvar = useCallback(
    (atual: DocumentoModelagem) => exercicioService.salvarDiagrama(exercicioId, atual),
    [exercicioId],
  )
  const status = useAutosaveModelagem(documento, salvar)

  useEffect(() => {
    onDocumentoChange?.(documento)
  }, [documento, onDocumentoChange])

  const modo = modoDoExercicio(modoExercicio)

  return (
    <EditorModelagem
      editavel={editavel}
      modo={modo}
      destaque={destaque ?? null}
      {...(onSelecionar ? { onSelecionar } : {})}
      capturaRef={capturaRef}
      barraDireita={
        <>
          <IndicadorSalvamento status={status} />
          <PedirDicaButton
            exercicioId={exercicioId}
            contexto="mer"
            estado={{ estadoMer: documento, ...(sqlAtual === undefined ? {} : { estadoSql: sqlAtual }) }}
            semConteudo={!documentoTemConteudo(documento)}
          />
        </>
      }
    />
  )
}

export default ModelagemCanvas
