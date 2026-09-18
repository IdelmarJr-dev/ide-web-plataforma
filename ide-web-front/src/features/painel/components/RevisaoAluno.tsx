import { useState } from 'react'
import type { ChangeEvent, ReactNode, SyntheticEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '~components/Button/Button'
import { Input } from '~components/Input/Input'
import { exercicioService } from '~features/exercicio/services/exercicioService'
import { NOTA_MAXIMA, revisarResultadoSchema } from '~features/exercicio/types'
import { painelService } from '../services/painelService'
import { ROTULO_ESTADO } from '../types'
import type { AtividadeDoAluno } from '../types'

interface NotasDigitadas {
  merAvaliacao?: string
  dissertativaAvaliacao?: string
  pontuacao?: string
  sqlCorreto?: boolean
}

function valorInicial(nota: number | null): string {
  return nota === null ? '' : String(nota)
}

/**
 * Uma atividade do aluno com o que ele entregou e os campos de nota. O professor
 * corrige a pessoa inteira numa tela só (Fase 10, D4).
 */
function CartaoAtividade({
  turmaId,
  usuarioId,
  atividade,
  onSalvo,
}: {
  turmaId: string
  usuarioId: string
  atividade: AtividadeDoAluno
  onSalvo: () => void
}): ReactNode {
  const queryClient = useQueryClient()
  const [notas, setNotas] = useState<NotasDigitadas>({})
  const [erro, setErro] = useState<string | null>(null)

  const sqlCorreto = notas.sqlCorreto ?? atividade.sqlCorreto ?? false
  const merAvaliacao = notas.merAvaliacao ?? valorInicial(atividade.merAvaliacao)
  const dissertativaAvaliacao = notas.dissertativaAvaliacao ?? valorInicial(atividade.dissertativaAvaliacao)
  const pontuacao = notas.pontuacao ?? valorInicial(atividade.pontuacao)

  const respostasQuery = useQuery({
    queryKey: ['exercicios', atividade.id, 'alunos', usuarioId, 'respostas'],
    queryFn: () => exercicioService.respostasDoAluno(atividade.id, usuarioId),
  })

  const invalidar = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['painel', 'turma', turmaId, 'alunos', usuarioId] })
  }

  const revisarMutation = useMutation({
    mutationFn: (input: Parameters<typeof exercicioService.revisarResultado>[2]) =>
      exercicioService.revisarResultado(atividade.id, usuarioId, input),
    onSuccess: () => {
      invalidar()
      onSalvo()
    },
  })

  const liberarMutation = useMutation({
    mutationFn: () => painelService.liberarEnvio(atividade.id, usuarioId),
    onSuccess: invalidar,
  })

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault()

    const resultado = revisarResultadoSchema.safeParse({
      ...(atividade.temSql ? { sqlCorreto } : {}),
      ...(atividade.temMer && merAvaliacao.trim() !== '' ? { merAvaliacao } : {}),
      ...(atividade.temDissertativa && dissertativaAvaliacao.trim() !== ''
        ? { dissertativaAvaliacao }
        : {}),
      ...(pontuacao.trim() === '' ? {} : { pontuacao }),
    })

    if (!resultado.success) {
      setErro(resultado.error.issues[0]?.message ?? 'Verifique as notas.')
      return
    }

    setErro(null)
    revisarMutation.mutate(resultado.data)
  }

  const respostas = respostasQuery.data

  return (
    <li className="rounded-lg border border-neutral-300 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-neutral-900">{atividade.titulo}</h2>
        <span className="text-xs text-neutral-600">
          {ROTULO_ESTADO[atividade.estado]} · {atividade.tentativas}{' '}
          {atividade.tentativas === 1 ? 'tentativa' : 'tentativas'}
          {atividade.dicas > 0 ? ` · ${String(atividade.dicas)} dicas` : ''}
        </span>
      </div>

      {/* D10: envio queimado sem chegar a executar — a decisão é do professor. */}
      {atividade.ultimoEnvioComErro ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary-500 bg-primary-50 p-3">
          <p className="text-sm text-neutral-800">
            O último envio deste aluno nem chegou a executar (erro de sintaxe). Em questão de prova, isso consumiu
            o envio único dele.
          </p>
          <Button
            variant="ghost"
            isLoading={liberarMutation.isPending}
            onClick={() => {
              liberarMutation.mutate()
            }}
          >
            Liberar novo envio
          </Button>
        </div>
      ) : null}

      {atividade.envioLiberadoEm === null ? null : (
        <p className="mt-2 text-xs text-success-700">
          Você liberou um envio: o aluno pode entregar de novo.
        </p>
      )}

      {respostas?.ultimaSubmissaoSql ? (
        <section className="mt-3">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h3 className="text-sm font-semibold text-neutral-900">Última consulta enviada</h3>
            {respostas.ultimaSubmissaoSql.correta === null ? (
              <span className="text-xs text-neutral-600">sem gabarito para conferir automaticamente</span>
            ) : (
              <span
                className={`text-xs font-medium ${
                  respostas.ultimaSubmissaoSql.correta ? 'text-success-700' : 'text-danger-500'
                }`}
              >
                {respostas.ultimaSubmissaoSql.correta ? 'correta pelo gabarito' : 'incorreta pelo gabarito'}
              </span>
            )}
          </div>
          <pre className="mt-2 overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800">
            <code>{respostas.ultimaSubmissaoSql.query}</code>
          </pre>
        </section>
      ) : null}

      {respostas?.dissertativa ? (
        <section className="mt-3">
          <h3 className="text-sm font-semibold text-neutral-900">Resposta dissertativa</h3>
          <p className="mt-2 whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800">
            {respostas.dissertativa.texto}
          </p>
        </section>
      ) : null}

      {atividade.temMer ? (
        <Link
          to={`/admin/turmas/${turmaId}/exercicios/${atividade.id}/revisar/${usuarioId}`}
          className="mt-3 inline-block text-sm font-medium text-primary-600 hover:underline"
        >
          Ver a modelagem entregue
        </Link>
      ) : null}

      {atividade.estado === 'nao_iniciou' ? (
        <p className="mt-3 rounded-md border border-primary-500 bg-primary-50 p-3 text-sm text-neutral-800">
          Este aluno não enviou nada nesta atividade. Você ainda pode registrar uma nota.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3" noValidate>
        {atividade.temSql ? (
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-900">
            <input
              type="checkbox"
              checked={sqlCorreto}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setNotas((atual) => ({ ...atual, sqlCorreto: event.target.checked }))
              }}
            />
            SQL correto
          </label>
        ) : null}

        {atividade.temMer ? (
          <Input
            label={`Modelagem (0,0 a ${String(NOTA_MAXIMA)},0)`}
            name={`mer-${atividade.id}`}
            type="number"
            step={0.1}
            min={0}
            max={NOTA_MAXIMA}
            value={merAvaliacao}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setNotas((atual) => ({ ...atual, merAvaliacao: event.target.value }))
            }}
          />
        ) : null}

        {atividade.temDissertativa ? (
          <Input
            label={`Dissertativa (0,0 a ${String(NOTA_MAXIMA)},0)`}
            name={`dissertativa-${atividade.id}`}
            type="number"
            step={0.1}
            min={0}
            max={NOTA_MAXIMA}
            value={dissertativaAvaliacao}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setNotas((atual) => ({ ...atual, dissertativaAvaliacao: event.target.value }))
            }}
          />
        ) : null}

        <Input
          label={`Nota final (0,0 a ${String(NOTA_MAXIMA)},0)`}
          name={`pontuacao-${atividade.id}`}
          type="number"
          step={0.1}
          min={0}
          max={NOTA_MAXIMA}
          value={pontuacao}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setNotas((atual) => ({ ...atual, pontuacao: event.target.value }))
          }}
        />

        <Button type="submit" isLoading={revisarMutation.isPending}>
          Salvar nota
        </Button>
      </form>

      {erro === null ? null : (
        <p role="alert" className="mt-2 text-sm text-danger-500">
          {erro}
        </p>
      )}
    </li>
  )
}

export const RevisaoAluno = (): ReactNode => {
  const { turmaId, usuarioId } = useParams<{ turmaId: string; usuarioId: string }>()
  const navigate = useNavigate()

  const atividadesQuery = useQuery({
    queryKey: ['painel', 'turma', turmaId, 'alunos', usuarioId],
    queryFn: () => painelService.atividadesDoAluno(turmaId ?? '', usuarioId ?? ''),
    enabled: turmaId !== undefined && usuarioId !== undefined,
  })

  const voltarParaLista = (): void => {
    // D5: corrigir é uma fila; depois de salvar, o professor volta a escolher quem é o próximo.
    void navigate(`/admin/turmas/${turmaId ?? ''}/painel`)
  }

  if (atividadesQuery.isLoading) {
    return <p className="p-6 text-sm text-neutral-600">Carregando as atividades do aluno…</p>
  }

  if (atividadesQuery.isError) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <p role="alert" className="text-sm text-danger-500">
          {atividadesQuery.error.message}
        </p>
        <Link to="/dashboard" className="text-sm font-medium text-primary-600 hover:underline">
          ← Voltar ao painel
        </Link>
      </div>
    )
  }

  const dados = atividadesQuery.data
  if (!dados) return null

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <header>
        <div className="flex flex-wrap gap-x-4">
          <Link to="/dashboard" className="text-sm font-medium text-primary-600 hover:underline">
            ← Voltar ao painel
          </Link>
          <Link
            to={`/admin/turmas/${turmaId ?? ''}/painel`}
            className="text-sm font-medium text-primary-600 hover:underline"
          >
            ← Voltar à turma
          </Link>
        </div>
        <h1 className="mt-3 text-xl font-semibold text-neutral-900">{dados.aluno.nome}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {dados.turma.nome} — {dados.turma.disciplina}
        </p>
      </header>

      {dados.atividades.length === 0 ? (
        <p className="text-sm text-neutral-600">Esta turma ainda não tem atividades para este aluno.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {dados.atividades.map((atividade) => (
            <CartaoAtividade
              key={atividade.id}
              turmaId={turmaId ?? ''}
              usuarioId={usuarioId ?? ''}
              atividade={atividade}
              onSalvo={voltarParaLista}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

export default RevisaoAluno
