import { useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '~components/Button/Button'
// Import direto (não pelo barrel `~features/exercicio`), que puxaria a ExercicioPage com o Monaco.
import { exercicioService } from '~features/exercicio/services/exercicioService'
import { acertosService, montarCsvPesquisa, pesquisaService, usePesquisaStatus } from '~features/pesquisa'
import type { Pesquisa } from '~features/pesquisa/types'
import { turmasService } from '~features/turmas'
import { triggerDownload } from '../../../lib/downloadBlob'

const POLL_INTERVAL_MS = 5000

/**
 * Pesquisador conduz a coleta numa turma: escolhe os exercícios da tarefa (os mesmos
 * pros dois grupos), inicia, sorteia os grupos entre quem aceitou o TCLE, acompanha,
 * encerra e exporta o CSV anonimizado. Ver docs/decisions/fase6-alinhamento-tcc.md.
 */
export const AdminPesquisaPage = (): ReactNode => {
  const [turmaId, setTurmaId] = useState('')

  const turmasQuery = useQuery({
    queryKey: ['turmas', 'minhas'],
    queryFn: turmasService.minhas,
  })

  const statusQuery = usePesquisaStatus(turmaId || null)
  const turmas = turmasQuery.data ?? []

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <Link to="/dashboard" className="text-sm font-medium text-primary-600 hover:underline">
          ← Voltar ao painel
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-neutral-900">Pesquisa do TCC</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Os alunos da turma veem o convite (TCLE) assim que a pesquisa é iniciada. O sorteio dos grupos só considera
          quem aceitou o termo.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="turma" className="text-sm font-medium text-neutral-900">
          Turma
        </label>
        <select
          id="turma"
          value={turmaId}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => { setTurmaId(event.target.value) }}
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <option value="">Selecione…</option>
          {turmas.map((turma) => (
            <option key={turma.id} value={turma.id}>
              {turma.nome} ({turma.codigo})
            </option>
          ))}
        </select>
      </div>

      {turmaId && statusQuery.data ? (
        statusQuery.data.iniciada && statusQuery.data.pesquisaId ? (
          <PainelPesquisaAtiva pesquisaId={statusQuery.data.pesquisaId} turmaId={turmaId} />
        ) : (
          <IniciarPesquisa turmaId={turmaId} />
        )
      ) : null}

      {turmaId ? <HistoricoPesquisas turmaId={turmaId} /> : null}
    </div>
  )
}

const IniciarPesquisa = ({ turmaId }: { turmaId: string }): ReactNode => {
  const queryClient = useQueryClient()
  const [selecionados, setSelecionados] = useState<string[]>([])

  const exerciciosQuery = useQuery({
    queryKey: ['turmas', turmaId, 'exercicios'],
    queryFn: () => exercicioService.listarPorTurma(turmaId),
  })

  const iniciarMutation = useMutation({
    mutationFn: () => pesquisaService.iniciarPesquisa(turmaId, selecionados),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pesquisa'] }),
  })

  const alternar = (exercicioId: string): void => {
    setSelecionados((atual) =>
      atual.includes(exercicioId) ? atual.filter((id) => id !== exercicioId) : [...atual, exercicioId],
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4">
      <h2 className="text-base font-semibold text-neutral-900">Iniciar pesquisa</h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm text-neutral-700">Exercícios da tarefa (os mesmos para os dois grupos):</legend>
        {exerciciosQuery.isLoading ? <p className="text-sm text-neutral-600">Carregando exercícios…</p> : null}
        {exerciciosQuery.data?.length === 0 ? (
          <p className="text-sm text-neutral-600">Esta turma ainda não tem exercícios.</p>
        ) : null}
        {exerciciosQuery.data?.map((exercicio) => (
          <label key={exercicio.id} className="flex items-center gap-2 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={selecionados.includes(exercicio.id)}
              onChange={() => { alternar(exercicio.id) }}
            />
            {exercicio.titulo}
            <span className="text-xs text-neutral-600">
              ({[exercicio.temMer ? 'MER' : null, exercicio.temSql ? 'SQL' : null].filter(Boolean).join(' + ') || 'dissertativa'})
            </span>
          </label>
        ))}
      </fieldset>
      {iniciarMutation.isError ? (
        <p role="alert" className="text-sm text-danger-500">
          {iniciarMutation.error.message}
        </p>
      ) : null}
      <Button
        disabled={selecionados.length === 0}
        isLoading={iniciarMutation.isPending}
        onClick={() => { iniciarMutation.mutate() }}
      >
        Iniciar pesquisa nesta turma
      </Button>
    </section>
  )
}

const PainelPesquisaAtiva = ({ pesquisaId, turmaId }: { pesquisaId: string; turmaId: string }): ReactNode => {
  const queryClient = useQueryClient()
  const [confirmandoEncerrar, setConfirmandoEncerrar] = useState(false)

  const participantesQuery = useQuery({
    queryKey: ['pesquisa', pesquisaId, 'participantes'],
    queryFn: () => pesquisaService.participantes(pesquisaId),
    refetchInterval: POLL_INTERVAL_MS,
  })

  const sortearMutation = useMutation({
    mutationFn: () => pesquisaService.sortearGrupos(pesquisaId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pesquisa'] }),
  })

  const encerrarMutation = useMutation({
    mutationFn: () => pesquisaService.encerrar(pesquisaId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pesquisa'] }),
  })

  const participantes = participantesQuery.data

  return (
    <section className="flex flex-col gap-4 rounded-md border border-primary-500 p-4">
      <h2 className="text-base font-semibold text-neutral-900">Pesquisa em andamento</h2>

      {participantes ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          <Contagem rotulo="Aceitaram o TCLE" valor={participantes.consentiram} />
          <Contagem rotulo="Recusaram" valor={participantes.recusaram} />
          <Contagem rotulo="Sem grupo ainda" valor={participantes.semGrupo} />
          <Contagem rotulo="Grupo controle" valor={participantes.controle} />
          <Contagem rotulo="Grupo experimental" valor={participantes.experimental} />
          <Contagem rotulo="Tarefas iniciadas" valor={participantes.sessoesIniciadas} />
          <Contagem rotulo="Tarefas finalizadas" valor={participantes.sessoesFinalizadas} />
          <Contagem rotulo="SUS respondidos" valor={participantes.susRespondidos} />
          <Contagem rotulo="RTLX respondidos" valor={participantes.rtlxRespondidos} />
        </dl>
      ) : (
        <p className="text-sm text-neutral-600">Carregando participantes…</p>
      )}

      <div className="flex flex-col gap-2">
        <Button
          disabled={!participantes || participantes.semGrupo === 0}
          isLoading={sortearMutation.isPending}
          onClick={() => { sortearMutation.mutate() }}
        >
          {participantes && participantes.semGrupo > 0
            ? `Sortear grupos (${String(participantes.semGrupo)} sem grupo)`
            : 'Sortear grupos'}
        </Button>
        <p className="text-xs text-neutral-600">
          Pode sortear de novo se mais alunos aceitarem depois: quem já tem grupo não muda, e os novos vão para o grupo
          menor.
        </p>
        {sortearMutation.data ? (
          <p role="status" className="text-sm text-neutral-800">
            {sortearMutation.data.alocadosAgora} alocados agora — controle: {sortearMutation.data.controle},
            experimental: {sortearMutation.data.experimental}.
          </p>
        ) : null}
        {sortearMutation.isError ? (
          <p role="alert" className="text-sm text-danger-500">
            {sortearMutation.error.message}
          </p>
        ) : null}
      </div>

      <ExportarCsvButton pesquisaId={pesquisaId} turmaId={turmaId} />

      {confirmandoEncerrar ? (
        <div className="flex flex-col gap-2 rounded-md border border-danger-500 p-3">
          <p className="text-sm text-neutral-900">
            Encerrar a pesquisa? Alunos não poderão mais aceitar o termo nem iniciar a tarefa (quem já finalizou ainda
            consegue terminar os questionários).
          </p>
          <div className="flex gap-2">
            <Button variant="danger" isLoading={encerrarMutation.isPending} onClick={() => { encerrarMutation.mutate() }}>
              Sim, encerrar
            </Button>
            <Button variant="ghost" onClick={() => { setConfirmandoEncerrar(false) }}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" onClick={() => { setConfirmandoEncerrar(true) }}>
          Encerrar pesquisa
        </Button>
      )}
    </section>
  )
}

const Contagem = ({ rotulo, valor }: { rotulo: string; valor: number }): ReactNode => (
  <div>
    <dt className="text-xs text-neutral-600">{rotulo}</dt>
    <dd className="font-medium text-neutral-900">{valor}</dd>
  </div>
)

const ExportarCsvButton = ({ pesquisaId, turmaId }: { pesquisaId: string; turmaId: string }): ReactNode => {
  const exportarMutation = useMutation({
    mutationFn: async () => {
      const exportacao = await pesquisaService.exportacao(pesquisaId)
      const acertos = await acertosService.buscar(exportacao.pesquisa.exercicioIds)
      return montarCsvPesquisa(exportacao, acertos)
    },
    onSuccess: (csv) => {
      triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `pesquisa-${turmaId}-${pesquisaId}.csv`)
    },
  })

  return (
    <div className="flex flex-col gap-1">
      <Button variant="ghost" isLoading={exportarMutation.isPending} onClick={() => { exportarMutation.mutate() }}>
        Exportar CSV anonimizado
      </Button>
      {exportarMutation.isError ? (
        <p role="alert" className="text-sm text-danger-500">
          {exportarMutation.error.message}
        </p>
      ) : null}
    </div>
  )
}

const HistoricoPesquisas = ({ turmaId }: { turmaId: string }): ReactNode => {
  const historicoQuery = useQuery({
    queryKey: ['pesquisa', 'historico', turmaId],
    queryFn: () => pesquisaService.historico(turmaId),
  })

  const encerradas = (historicoQuery.data ?? []).filter((pesquisa: Pesquisa) => pesquisa.encerradaEm !== null)
  if (encerradas.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-neutral-900">Pesquisas encerradas</h2>
      <ul className="flex flex-col gap-2">
        {encerradas.map((pesquisa) => (
          <li key={pesquisa.id} className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 p-3">
            <span className="text-sm text-neutral-800">
              {new Date(pesquisa.iniciadaEm).toLocaleString('pt-BR')} —{' '}
              {pesquisa.encerradaEm ? new Date(pesquisa.encerradaEm).toLocaleString('pt-BR') : ''}
            </span>
            <ExportarCsvButton pesquisaId={pesquisa.id} turmaId={turmaId} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export default AdminPesquisaPage
