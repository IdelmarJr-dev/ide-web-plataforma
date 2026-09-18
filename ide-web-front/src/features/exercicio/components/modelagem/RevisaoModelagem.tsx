import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { DocumentoModelagem, ModoModelagem } from '../../modelagem/documento'
import { documentoTemConteudo, parseDocumento } from '../../modelagem/documento'
import { modoDoExercicio } from '../../modelagem/modos'
import { useDocumentoEditavel } from '../../modelagem/useDocumentoEditavel'
import { exercicioService } from '../../services/exercicioService'
import { EditorModelagem } from './EditorModelagem'

interface VisualizadorProps {
  documento: DocumentoModelagem
  modo: ModoModelagem
}

/** O editor em modo leitura; o histórico existe só porque o editor pede um. */
const Visualizador = ({ documento, modo }: VisualizadorProps): ReactNode => {
  const editavel = useDocumentoEditavel(documento)
  return <EditorModelagem editavel={editavel} modo={modo} somenteLeitura />
}

/**
 * Em leitura, o nível vem do que o documento tem: um gabarito pode trazer os dois modelos
 * mesmo num exercício de um nível só. Sem conteúdo, cai no nível do exercício.
 */
function modoParaLer(documento: DocumentoModelagem, padrao: ModoModelagem): ModoModelagem {
  const temConceitual = (documento.conceitual?.elementos.length ?? 0) > 0
  const temLogico = (documento.logico?.tabelas.length ?? 0) > 0
  if (temConceitual && temLogico) return 'conceitual_logico'
  if (temConceitual) return 'conceitual'
  if (temLogico) return 'logico'
  return padrao
}

interface RevisaoModelagemProps {
  exercicioId: string
  usuarioId: string
  modoExercicio: ModoModelagem
  // `mer_gabarito` do exercício (só o professor recebe).
  gabarito: unknown
}

type Fonte = 'aluno' | 'gabarito'

const CLASSE_ABA =
  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500'

/**
 * Revisão do professor: leitura do modelo entregue pelo aluno, lado a lado com o gabarito
 * (docs/decisions/fase7-modelagem-conceitual-logica.md). Nada aqui grava no diagrama do aluno.
 */
export const RevisaoModelagem = ({ exercicioId, usuarioId, modoExercicio, gabarito }: RevisaoModelagemProps): ReactNode => {
  const [fonte, setFonte] = useState<Fonte>('aluno')

  const diagramaQuery = useQuery({
    queryKey: ['exercicios', exercicioId, 'alunos', usuarioId, 'diagrama'],
    queryFn: () => exercicioService.diagramaDoAluno(exercicioId, usuarioId),
  })

  const documentoAluno = useMemo(() => parseDocumento(diagramaQuery.data?.conteudoJson), [diagramaQuery.data])
  const documentoGabarito = useMemo(() => parseDocumento(gabarito), [gabarito])
  const temGabarito = gabarito !== null && gabarito !== undefined

  const documento = fonte === 'aluno' ? documentoAluno : documentoGabarito
  const modo = modoParaLer(documento, modoDoExercicio(modoExercicio))
  // Canvas em branco não diz se o aluno não respondeu ou se a leitura falhou: o texto diz.
  const vazio = !documentoTemConteudo(documento)

  return (
    <section aria-label="Modelagem do aluno" className="flex h-[70vh] min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="O que mostrar" className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          <button
            type="button"
            role="tab"
            aria-selected={fonte === 'aluno'}
            className={`${CLASSE_ABA} ${fonte === 'aluno' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'}`}
            onClick={() => { setFonte('aluno') }}
          >
            Modelo do aluno
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={fonte === 'gabarito'}
            disabled={!temGabarito}
            title={temGabarito ? undefined : 'Este exercício não tem gabarito de modelagem'}
            className={`${CLASSE_ABA} disabled:cursor-not-allowed disabled:opacity-50 ${
              fonte === 'gabarito' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'
            }`}
            onClick={() => { setFonte('gabarito') }}
          >
            Gabarito
          </button>
        </div>
        <p className="text-xs text-neutral-600">Só leitura — a nota continua sendo sua, no formulário abaixo.</p>
      </div>

      <div className="min-h-0 flex-1">
        {diagramaQuery.isLoading ? (
          <p className="p-3 text-sm text-neutral-600">Carregando o modelo do aluno…</p>
        ) : diagramaQuery.isError && fonte === 'aluno' ? (
          <p role="alert" className="rounded-md border border-danger-500 p-3 text-sm text-danger-600">
            Não foi possível carregar o modelo deste aluno. Recarregue a página antes de dar a nota — o modelo pode
            existir e não ter sido exibido.
          </p>
        ) : vazio ? (
          <p className="rounded-md border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-600">
            {fonte === 'aluno'
              ? 'Este aluno não entregou modelagem: o documento chegou do servidor sem nenhuma entidade ou tabela.'
              : 'Este exercício não tem gabarito de modelagem cadastrado.'}
          </p>
        ) : (
          <Visualizador key={fonte} documento={documento} modo={modo} />
        )}
      </div>
    </section>
  )
}

export default RevisaoModelagem
