import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useBloqueioPesquisa } from '~features/pesquisa'
import type { CapturarModelos } from '../modelagem/captura'
import { DOCUMENTO_VAZIO, LOGICO_VAZIO } from '../modelagem/documento'
import type { DocumentoModelagem } from '../modelagem/documento'
import { gerarSql } from '../modelagem/gerarSql'
import { modoDoExercicio } from '../modelagem/modos'
import { extrairAliases, identificadorNaPosicao, ocorrenciasNoSql, resolverSelecao } from '../modelagem/sincronizacao'
import type { Selecao } from '../modelagem/sincronizacao'
import { exercicioService } from '../services/exercicioService'
import { DissertativaEditor } from './DissertativaEditor'
import { FinalizarPacoteButton } from './FinalizarPacoteButton'
import { ModelagemCanvas } from './modelagem/ModelagemCanvas'
import { SqlModeloPainel } from './modelagem/SqlModeloPainel'
import { useBloqueioCopia } from '../hooks/useBloqueioCopia'
import { SandboxPainel } from './SandboxPainel'
import { SQLEditor } from './SQLEditor'

const DEFAULT_SQL = '-- escreva sua consulta aqui\n'
const SEM_DESTAQUES: never[] = []

export const ExercicioPage = (): ReactNode => {
  const { id } = useParams<{ id: string }>()
  const [sql, setSql] = useState(DEFAULT_SQL)
  const [dissertativa, setDissertativa] = useState('')
  const [documento, setDocumento] = useState<DocumentoModelagem>(DOCUMENTO_VAZIO)
  const [selecao, setSelecao] = useState<Selecao | null>(null)
  const capturaRef = useRef<CapturarModelos | null>(null)
  const { bloqueado } = useBloqueioPesquisa()

  const exercicioQuery = useQuery({
    queryKey: ['exercicios', id],
    queryFn: () => exercicioService.buscarPorId(id ?? ''),
    enabled: id !== undefined,
  })

  const exercicio = exercicioQuery.data
  // Sem lógico (modo puramente conceitual) não há SQL do modelo pra mostrar nem sincronizar.
  const modoAtual = exercicio ? modoDoExercicio(exercicio.modoMer) : null
  const temModeloLogico = modoAtual !== 'conceitual'
  const sincronizar = Boolean(exercicio?.temMer && exercicio.temSql) && temModeloLogico

  // Dissuasão durante a prova; ver useBloqueioCopia (Fase 10, D11).
  useBloqueioCopia(exercicio?.provaId != null)

  const sqlDoModelo = useMemo(() => gerarSql(documento.logico ?? LOGICO_VAZIO), [documento.logico])
  const aliases = useMemo(() => extrairAliases(sql), [sql])
  const destaquesSql = useMemo(
    () => (sincronizar && selecao ? ocorrenciasNoSql(sql, selecao, aliases) : SEM_DESTAQUES),
    [sincronizar, selecao, sql, aliases],
  )

  const handleCursorSql = useCallback(
    (offset: number) => {
      if (!sincronizar) return
      const identificador = identificadorNaPosicao(sql, offset)
      if (!identificador) return
      const novaSelecao = resolverSelecao(identificador, sqlDoModelo.tabelas, aliases)
      if (novaSelecao) setSelecao(novaSelecao)
    },
    [sincronizar, sql, sqlDoModelo, aliases],
  )

  if (bloqueado) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-2 p-6">
        <p className="text-sm font-medium text-neutral-900">
          Durante a pesquisa, seu grupo resolve as tarefas com as ferramentas tradicionais.
        </p>
        <p className="text-sm text-neutral-600">
          A IDE Web fica indisponível para você até a pesquisa ser encerrada.{' '}
          <Link to="/pesquisa/sessao" className="font-medium text-primary-600 hover:underline">
            Voltar para a pesquisa
          </Link>
        </p>
      </div>
    )
  }

  if (exercicioQuery.isLoading) {
    return <p className="p-6 text-sm text-neutral-600">Carregando exercício…</p>
  }

  if (exercicioQuery.isError || !exercicio) {
    return (
      <div className="flex flex-col gap-2 p-6">
        <p role="alert" className="text-sm text-danger-500">
          Não foi possível carregar este exercício.
        </p>
        <Link to="/dashboard" className="text-sm font-medium text-primary-600 hover:underline">
          ← Voltar à turma
        </Link>
      </div>
    )
  }

  const duasColunas = exercicio.temMer && exercicio.temSql

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      {/* Empilhado por padrão: num header de uma linha só, "truncate" no título espremia
          tudo pra caber ao lado do link e dos botões e sobrava só "S..." em 390px.
          `pr-14` reserva espaço pro BotaoTema flutuante no canto superior direito. */}
      <header
        className="flex flex-col gap-2 border-b border-neutral-200 bg-surface py-2 pl-4 pr-14
          sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2"
      >
        <Link to="/dashboard" className="text-sm font-medium text-primary-600 hover:underline">
          ← Voltar à turma
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-neutral-900">{exercicio.titulo}</h1>
        <FinalizarPacoteButton
          exercicioId={exercicio.id}
          capturaRef={exercicio.temMer ? capturaRef : undefined}
          sqlModelo={exercicio.temMer && temModeloLogico ? sqlDoModelo.sql : undefined}
        />
      </header>

      <details open className="border-b border-neutral-200 bg-surface px-4 py-2">
        <summary className="cursor-pointer text-sm font-medium text-neutral-800">Enunciado</summary>
        <p className="mt-1 max-h-32 overflow-auto whitespace-pre-line text-sm text-neutral-700">{exercicio.enunciado}</p>
      </details>

      <main
        className={`grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 ${
          duasColunas ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : ''
        } ${duasColunas && exercicio.temDissertativa ? 'lg:grid-rows-[minmax(0,1fr)_auto]' : ''}`}
      >
        {exercicio.temMer ? (
          <section aria-label="Modelagem" className="flex h-[80vh] min-h-0 flex-col gap-2 lg:h-auto">
            <div className="min-h-0 flex-1">
              <ModelagemCanvas
                exercicioId={exercicio.id}
                modoExercicio={exercicio.modoMer}
                capturaRef={capturaRef}
                onDocumentoChange={setDocumento}
                destaque={sincronizar ? selecao : null}
                onSelecionar={setSelecao}
                {...(exercicio.temSql ? { sqlAtual: sql } : {})}
              />
            </div>
            {temModeloLogico ? <SqlModeloPainel sql={sqlDoModelo} tabelaDestacada={sincronizar ? (selecao?.tabela ?? null) : null} /> : null}
          </section>
        ) : null}
        {exercicio.temSql ? (
          <section aria-label="Consulta SQL" className="flex h-[80vh] min-h-0 flex-col gap-2 lg:h-auto">
            <div className="min-h-48 flex-1">
              <SQLEditor
                exercicioId={exercicio.id}
                value={sql}
                onChange={setSql}
                destaques={destaquesSql}
                onCursorChange={handleCursorSql}
                {...(exercicio.temMer ? { estadoMer: documento } : {})}
              />
            </div>
            <SandboxPainel exercicioId={exercicio.id} sql={sql} ehProva={exercicio.provaId !== null} />
          </section>
        ) : null}
        {exercicio.temDissertativa ? (
          <section aria-label="Resposta dissertativa" className={`min-h-48 ${duasColunas ? 'lg:col-span-2 lg:h-48' : ''}`}>
            <DissertativaEditor value={dissertativa} onChange={setDissertativa} />
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default ExercicioPage
