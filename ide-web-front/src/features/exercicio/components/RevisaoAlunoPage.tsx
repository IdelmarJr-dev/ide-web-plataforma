import { useState } from 'react'
import type { ChangeEvent, ReactNode, SyntheticEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '~components/Button/Button'
import { Input } from '~components/Input/Input'
import { exercicioService } from '../services/exercicioService'
import { revisarResultadoSchema } from '../types'
import type { RespostasDoAluno } from '../types'
import { RevisaoModelagem } from './modelagem/RevisaoModelagem'

/**
 * A tela mostrava só os campos de nota: o professor corrigia sem ver o que o aluno
 * entregou (relatório de testes 2026-09-16, Fase 9 D17). A modelagem tem componente
 * próprio logo acima, então aqui ficam só SQL e dissertativa.
 */
function RespostasEntregues({ respostas, temMer }: { respostas: RespostasDoAluno; temMer: boolean }): ReactNode {
  const { ultimaSubmissaoSql, dissertativa } = respostas
  const semEntrega = ultimaSubmissaoSql === null && dissertativa === null && !temMer

  if (semEntrega) {
    return (
      <p className="rounded-md border border-primary-500 bg-primary-50 p-3 text-sm text-neutral-800">
        Este aluno não enviou nada neste exercício. Você ainda pode registrar uma nota.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {ultimaSubmissaoSql ? (
        <section>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-sm font-semibold text-neutral-900">Última consulta enviada</h2>
            {ultimaSubmissaoSql.correta === null ? (
              <span className="text-xs text-neutral-600">sem gabarito para conferir automaticamente</span>
            ) : (
              <span className={`text-xs font-medium ${ultimaSubmissaoSql.correta ? 'text-success-700' : 'text-danger-500'}`}>
                {ultimaSubmissaoSql.correta ? 'correta pelo gabarito' : 'incorreta pelo gabarito'}
              </span>
            )}
          </div>
          <pre className="mt-2 overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800">
            <code>{ultimaSubmissaoSql.query}</code>
          </pre>
        </section>
      ) : null}

      {dissertativa ? (
        <section>
          <h2 className="text-sm font-semibold text-neutral-900">Resposta dissertativa</h2>
          <p className="mt-2 whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800">
            {dissertativa.texto}
          </p>
        </section>
      ) : null}
    </div>
  )
}

interface FieldErrors {
  merAvaliacao?: string
  dissertativaAvaliacao?: string
  pontuacao?: string
}

export const RevisaoAlunoPage = (): ReactNode => {
  const { turmaId, exercicioId, usuarioId } = useParams<{
    turmaId: string
    exercicioId: string
    usuarioId: string
  }>()
  const queryClient = useQueryClient()

  // `null` = campo ainda não editado pelo professor nesta sessão — mostra o valor vindo do
  // servidor. Uma vez editado, o valor digitado passa a mandar (evita re-hidratar via efeito).
  const [sqlCorreto, setSqlCorreto] = useState<boolean | null>(null)
  const [merAvaliacao, setMerAvaliacao] = useState<string | null>(null)
  const [dissertativaAvaliacao, setDissertativaAvaliacao] = useState<string | null>(null)
  const [pontuacao, setPontuacao] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const exercicioQuery = useQuery({
    queryKey: ['exercicios', exercicioId],
    queryFn: () => exercicioService.buscarPorId(exercicioId ?? ''),
    enabled: exercicioId !== undefined,
  })

  const resultadoQuery = useQuery({
    queryKey: ['exercicios', exercicioId, 'alunos', usuarioId, 'resultado'],
    queryFn: () => exercicioService.resultadoDoAluno(exercicioId ?? '', usuarioId ?? ''),
    enabled: exercicioId !== undefined && usuarioId !== undefined,
  })

  const resultado = resultadoQuery.data
  const sqlCorretoValor = sqlCorreto ?? resultado?.sqlCorreto ?? false
  const merAvaliacaoValor = merAvaliacao ?? (resultado?.merAvaliacao !== null && resultado?.merAvaliacao !== undefined ? String(resultado.merAvaliacao) : '')
  const dissertativaAvaliacaoValor =
    dissertativaAvaliacao ??
    (resultado?.dissertativaAvaliacao !== null && resultado?.dissertativaAvaliacao !== undefined
      ? String(resultado.dissertativaAvaliacao)
      : '')
  const pontuacaoValor = pontuacao ?? (resultado?.pontuacao !== null && resultado?.pontuacao !== undefined ? String(resultado.pontuacao) : '')

  const respostasQuery = useQuery({
    queryKey: ['exercicios', exercicioId, 'alunos', usuarioId, 'respostas'],
    queryFn: () => exercicioService.respostasDoAluno(exercicioId ?? '', usuarioId ?? ''),
    enabled: exercicioId !== undefined && usuarioId !== undefined,
  })

  const revisarMutation = useMutation({
    mutationFn: (input: Parameters<typeof exercicioService.revisarResultado>[2]) =>
      exercicioService.revisarResultado(exercicioId ?? '', usuarioId ?? '', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exercicios', exercicioId, 'alunos', usuarioId, 'resultado'] })
    },
  })

  const exercicio = exercicioQuery.data

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault()

    const result = revisarResultadoSchema.safeParse({
      ...(exercicio?.temSql ? { sqlCorreto: sqlCorretoValor } : {}),
      ...(exercicio?.temMer && merAvaliacaoValor.trim() !== '' ? { merAvaliacao: merAvaliacaoValor } : {}),
      ...(exercicio?.temDissertativa && dissertativaAvaliacaoValor.trim() !== ''
        ? { dissertativaAvaliacao: dissertativaAvaliacaoValor }
        : {}),
      ...(pontuacaoValor.trim() !== '' ? { pontuacao: pontuacaoValor } : {}),
    })

    if (!result.success) {
      const errors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const fieldName = issue.path[0]
        if (fieldName === 'merAvaliacao' || fieldName === 'dissertativaAvaliacao' || fieldName === 'pontuacao') {
          errors[fieldName] = issue.message
        }
      }
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    revisarMutation.mutate(result.data)
  }

  if (exercicioQuery.isLoading || resultadoQuery.isLoading) {
    return <p className="p-6 text-sm text-neutral-600">Carregando…</p>
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <header>
        <Link to={`/admin/turmas/${turmaId ?? ''}/exercicios/${exercicioId ?? ''}/revisar`} className="text-sm font-medium text-primary-600 hover:underline">
          ← Voltar à lista de alunos
        </Link>
        <h1 className="mt-3 text-lg font-semibold text-neutral-900">
          Revisar resultado {exercicio ? `— ${exercicio.titulo}` : ''}
        </h1>
      </header>

      {respostasQuery.data ? (
        <RespostasEntregues respostas={respostasQuery.data} temMer={exercicio?.temMer ?? false} />
      ) : null}

      {exercicio?.temMer && exercicioId !== undefined && usuarioId !== undefined ? (
        <RevisaoModelagem
          exercicioId={exercicioId}
          usuarioId={usuarioId}
          modoExercicio={exercicio.modoMer}
          gabarito={'merGabarito' in exercicio ? exercicio.merGabarito : null}
        />
      ) : null}

      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4" noValidate>
        {exercicio?.temSql ? (
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-900">
            <input
              type="checkbox"
              checked={sqlCorretoValor}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setSqlCorreto(event.target.checked)
              }}
            />
            SQL correto
          </label>
        ) : null}

        {exercicio?.temMer ? (
          <Input
            label="Avaliação do diagrama MER (0,0 a 10,0)"
            name="merAvaliacao"
            type="number"
            step={0.1}
            min={0}
            max={10}
            value={merAvaliacaoValor}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setMerAvaliacao(event.target.value)
            }}
            errorMessage={fieldErrors.merAvaliacao}
          />
        ) : null}

        {exercicio?.temDissertativa ? (
          <Input
            label="Avaliação da dissertativa (0,0 a 10,0)"
            name="dissertativaAvaliacao"
            type="number"
            step={0.1}
            min={0}
            max={10}
            value={dissertativaAvaliacaoValor}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setDissertativaAvaliacao(event.target.value)
            }}
            errorMessage={fieldErrors.dissertativaAvaliacao}
          />
        ) : null}

        <Input
          label="Pontuação final (0,0 a 10,0)"
          name="pontuacao"
          type="number"
          step={0.1}
          min={0}
          max={10}
          value={pontuacaoValor}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setPontuacao(event.target.value)
          }}
          errorMessage={fieldErrors.pontuacao}
        />

        {revisarMutation.isError ? (
          <p role="alert" className="text-sm text-danger-500">
            {revisarMutation.error.message}
          </p>
        ) : null}
        {revisarMutation.isSuccess ? <p className="text-sm text-success-700">Revisão salva.</p> : null}

        <Button type="submit" isLoading={revisarMutation.isPending}>
          Salvar revisão
        </Button>
      </form>
    </div>
  )
}

export default RevisaoAlunoPage
