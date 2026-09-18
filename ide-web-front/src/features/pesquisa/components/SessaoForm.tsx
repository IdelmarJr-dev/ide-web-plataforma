import { useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '~components/Button/Button'
// Import direto (não pelo barrel `~features/exercicio`): o barrel reexporta a
// ExercicioPage, que carrega o Monaco — pesado e quebra em teste sem browser real.
import { exercicioService } from '~features/exercicio/services/exercicioService'
import type { ExercicioAluno } from '~features/exercicio/types'
import { MINHA_PARTICIPACAO_QUERY_KEY, useMinhaParticipacao } from '../hooks/useMinhaParticipacao'
import { pesquisaService } from '../services/pesquisaService'
import type { Ambiente, MinhaParticipacao, Pesquisa, SessaoResumo } from '../types'
import { ControleEntrega } from './ControleEntrega'
import { Cronometro } from './Cronometro'

const AMBIENTE_DESCRICAO: Record<Ambiente, string> = {
  ide_web: 'a IDE Web (diagrama MER e editor SQL na mesma tela)',
  ferramentas_tradicionais: 'as ferramentas tradicionais da disciplina (editor de diagramas e pgAdmin/psql), fora da IDE Web',
}

const LINK_CLASSES = 'text-sm font-medium text-primary-600 hover:underline'

const Aviso = ({ titulo, children }: { titulo: string; children?: ReactNode }): ReactNode => (
  <div className="flex flex-col gap-2">
    <p className="text-sm font-medium text-neutral-900">{titulo}</p>
    {children}
  </div>
)

/**
 * Fluxo do aluno na pesquisa, dirigido pelo estado do servidor (`minha-participacao`):
 * TCLE → aguardar sorteio → iniciar tarefa → resolver (IDE ou ferramentas
 * tradicionais) → finalizar → SUS → RTLX. Ver docs/decisions/fase6-alinhamento-tcc.md.
 */
export const SessaoForm = (): ReactNode => {
  const participacaoQuery = useMinhaParticipacao()
  const participacao = participacaoQuery.data

  if (participacaoQuery.isLoading) {
    return <p className="text-sm text-neutral-600">Carregando…</p>
  }

  if (participacaoQuery.isError) {
    return (
      <p role="alert" className="text-sm text-danger-500">
        Não foi possível falar com o serviço da pesquisa: {participacaoQuery.error.message}
      </p>
    )
  }

  if (!participacao?.pesquisa) {
    return (
      <Aviso titulo="Nenhuma pesquisa em andamento na sua turma.">
        <Link to="/dashboard" className={LINK_CLASSES}>
          Voltar ao painel
        </Link>
      </Aviso>
    )
  }

  if (participacao.tcle !== 'aceito') {
    return (
      <Aviso titulo="Para participar, primeiro leia e aceite o termo de consentimento.">
        <Link to="/tcle" className={LINK_CLASSES}>
          Ver o termo de consentimento
        </Link>
      </Aviso>
    )
  }

  if (!participacao.grupo || !participacao.ambiente) {
    return (
      <Aviso titulo="Consentimento registrado. Aguarde o pesquisador sortear os grupos.">
        <p className="text-sm text-neutral-600">Esta tela atualiza sozinha assim que o sorteio acontecer.</p>
      </Aviso>
    )
  }

  if (!participacao.sessao) {
    return <IniciarTarefa ambiente={participacao.ambiente} />
  }

  if (!participacao.sessao.finalizadaEm) {
    return <TarefaEmAndamento participacao={participacao} pesquisa={participacao.pesquisa} sessao={participacao.sessao} />
  }

  if (!participacao.susRespondido) {
    return (
      <Aviso titulo="Tarefa finalizada. Agora, o primeiro questionário.">
        <Link to="/pesquisa/sus" className={LINK_CLASSES}>
          Responder o questionário de usabilidade (SUS) →
        </Link>
      </Aviso>
    )
  }

  if (!participacao.rtlxRespondido) {
    return (
      <Aviso titulo="Falta só o último questionário.">
        <Link to="/pesquisa/rtlx" className={LINK_CLASSES}>
          Responder o questionário de carga mental (RTLX) →
        </Link>
      </Aviso>
    )
  }

  return (
    <Aviso titulo="Obrigado por participar!">
      <p className="text-sm text-neutral-600">Suas respostas foram registradas.</p>
      <Link to="/dashboard" className={LINK_CLASSES}>
        Voltar ao painel
      </Link>
    </Aviso>
  )
}

const IniciarTarefa = ({ ambiente }: { ambiente: Ambiente }): ReactNode => {
  const queryClient = useQueryClient()
  const iniciarMutation = useMutation({
    mutationFn: pesquisaService.iniciarSessao,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MINHA_PARTICIPACAO_QUERY_KEY }),
  })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-700">
        No sorteio, você vai resolver as tarefas usando <strong>{AMBIENTE_DESCRICAO[ambiente]}</strong>.
      </p>
      <p className="text-sm text-neutral-600">
        Acompanhe o tutorial do pesquisador e só clique em iniciar quando ele pedir — o tempo começa a contar a partir
        daí.
      </p>
      {iniciarMutation.isError ? (
        <p role="alert" className="text-sm text-danger-500">
          {iniciarMutation.error.message}
        </p>
      ) : null}
      <Button isLoading={iniciarMutation.isPending} onClick={() => { iniciarMutation.mutate() }}>
        Iniciar tarefa
      </Button>
    </div>
  )
}

interface TarefaEmAndamentoProps {
  participacao: MinhaParticipacao
  pesquisa: Pesquisa
  sessao: SessaoResumo
}

const TarefaEmAndamento = ({ participacao, pesquisa, sessao }: TarefaEmAndamentoProps): ReactNode => {
  const queryClient = useQueryClient()
  const [confirmando, setConfirmando] = useState(false)

  // A turma da tarefa é a da pesquisa — o aluno pode estar em várias turmas (Fase 8).
  const exerciciosQuery = useQuery({
    queryKey: ['turmas', pesquisa.turmaId, 'exercicios'],
    queryFn: () => exercicioService.listarPorTurma(pesquisa.turmaId),
  })

  const finalizarMutation = useMutation({
    mutationFn: () => pesquisaService.finalizarSessao(sessao.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MINHA_PARTICIPACAO_QUERY_KEY }),
  })

  const porId = new Map((exerciciosQuery.data ?? []).map((exercicio) => [exercicio.id, exercicio]))
  const exerciciosDaTarefa = pesquisa.exercicioIds
    .map((id) => porId.get(id))
    .filter((exercicio): exercicio is ExercicioAluno => exercicio !== undefined)

  return (
    <div className="flex flex-col gap-4">
      <Cronometro inicio={sessao.iniciadaEm} />

      {exerciciosQuery.isLoading ? <p className="text-sm text-neutral-600">Carregando exercícios…</p> : null}

      {participacao.ambiente === 'ide_web' ? (
        <ul className="flex flex-col gap-2">
          {exerciciosDaTarefa.map((exercicio) => (
            <li key={exercicio.id} className="rounded-md border border-neutral-200 p-3">
              <Link to={`/exercicios/${exercicio.id}`} className={LINK_CLASSES}>
                {exercicio.titulo} — abrir na IDE Web →
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {exerciciosDaTarefa.map((exercicio) => (
            <ControleEntrega key={exercicio.id} pesquisaId={pesquisa.id} exercicio={exercicio} />
          ))}
        </ul>
      )}

      {finalizarMutation.isError ? (
        <p role="alert" className="text-sm text-danger-500">
          {finalizarMutation.error.message}
        </p>
      ) : null}

      {confirmando ? (
        <div className="flex flex-col gap-2 rounded-md border border-danger-500 p-3">
          <p className="text-sm text-neutral-900">Finalizar a tarefa? Depois disso não dá para voltar a ela.</p>
          <div className="flex gap-2">
            <Button variant="danger" isLoading={finalizarMutation.isPending} onClick={() => { finalizarMutation.mutate() }}>
              Sim, finalizar
            </Button>
            <Button variant="ghost" onClick={() => { setConfirmando(false) }}>
              Continuar a tarefa
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => { setConfirmando(true) }}>Terminei — finalizar tarefa</Button>
      )}
    </div>
  )
}

export default SessaoForm
