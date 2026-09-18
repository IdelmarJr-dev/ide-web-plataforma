import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePainelTurma } from '../hooks/usePainel'
import { ROTULO_ESTADO } from '../types'
import type { CelulaMatriz, EstadoCelula } from '../types'
import { ExerciciosDificeis } from './ExerciciosDificeis'

/**
 * Cada estado tem rótulo textual além da cor — cor sozinha exclui daltônicos, e a grade
 * é uma `<table>` de verdade para leitor de tela (Fase 9, D10).
 */
const ESTILO_ESTADO: Record<EstadoCelula, string> = {
  nao_iniciou: 'bg-neutral-50 text-neutral-600',
  em_andamento: 'bg-primary-50 text-primary-700',
  entregue: 'bg-neutral-100 text-neutral-800',
  correto: 'bg-success-50 text-success-700',
  aguardando_revisao: 'bg-primary-100 text-primary-700 font-semibold',
}

/**
 * Símbolos que se leem sozinhos. "E" de entregue não dizia nada a quem chega agora —
 * foi onde o professor tropeçou no teste de uso (Fase 10, D15).
 */
const SIMBOLO: Record<EstadoCelula, string> = {
  nao_iniciou: '–',
  em_andamento: '◐',
  entregue: '✉',
  correto: '✓',
  aguardando_revisao: '⚑',
}

function formatarNota(nota: number | null): string {
  return nota === null ? '' : nota.toFixed(1).replace('.', ',')
}

export const MatrizTurma = (): ReactNode => {
  const { turmaId } = useParams<{ turmaId: string }>()
  const painelQuery = usePainelTurma(turmaId)

  if (painelQuery.isLoading) {
    return <p className="p-6 text-sm text-neutral-600">Carregando a turma…</p>
  }

  if (painelQuery.isError) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <p role="alert" className="text-sm text-danger-500">
          {painelQuery.error.message}
        </p>
        <Link to="/dashboard" className="text-sm font-medium text-primary-600 hover:underline">
          ← Voltar ao painel
        </Link>
      </div>
    )
  }

  const painel = painelQuery.data
  if (!painel) return null

  const celulaPorPar = new Map<string, CelulaMatriz>(
    painel.celulas.map((celula) => [`${celula.alunoId}:${celula.exercicioId}`, celula]),
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <Link to="/dashboard" className="text-sm font-medium text-primary-600 hover:underline">
          ← Voltar ao painel
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-neutral-900">{painel.turma.nome}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {painel.turma.disciplina} — {painel.turma.semestre}
        </p>
      </header>

      {painel.alunos.length === 0 || painel.exercicios.length === 0 ? (
        <p className="text-sm text-neutral-600">
          {painel.alunos.length === 0
            ? 'Nenhum aluno se matriculou nesta turma ainda.'
            : 'Esta turma ainda não tem exercícios cadastrados.'}
        </p>
      ) : (
        <>
          <section aria-label="Legenda">
            <ul className="flex flex-wrap gap-2">
              {(Object.keys(ROTULO_ESTADO) as EstadoCelula[]).map((estado) => (
                <li key={estado} className={`rounded-md px-2 py-1 text-xs ${ESTILO_ESTADO[estado]}`}>
                  <span aria-hidden="true">{SIMBOLO[estado]}</span> {ROTULO_ESTADO[estado]}
                </li>
              ))}
            </ul>
          </section>

          <section className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <caption className="sr-only">Situação de cada aluno em cada exercício da turma</caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-surface p-2 font-medium text-neutral-900">
                    Aluno
                  </th>
                  {painel.exercicios.map((exercicio) => (
                    <th key={exercicio.id} scope="col" className="p-2 text-xs font-medium text-neutral-700">
                      {exercicio.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {painel.alunos.map((aluno) => (
                  <tr key={aluno.id} className="border-t border-neutral-100">
                    <th scope="row" className="sticky left-0 z-10 bg-surface p-2 font-normal text-neutral-900">
                      {aluno.nome}
                    </th>
                    {painel.exercicios.map((exercicio) => {
                      const celula = celulaPorPar.get(`${aluno.id}:${exercicio.id}`)

                      if (!celula) {
                        // D3: exercício de outra prova — o aluno nunca o viu.
                        return (
                          <td key={exercicio.id} className="p-2 text-center text-xs text-neutral-300">
                            <span className="sr-only">Não faz parte da prova deste aluno</span>
                            <span aria-hidden="true">·</span>
                          </td>
                        )
                      }

                      return (
                        <td key={exercicio.id} className="p-1 text-center">
                          <Link
                            to={`/admin/turmas/${painel.turma.id}/alunos/${aluno.id}`}
                            className={`inline-flex min-w-14 items-center justify-center gap-1 rounded-md px-2 py-1 text-xs
                              hover:underline ${ESTILO_ESTADO[celula.estado]}`}
                          >
                            <span aria-hidden="true">{SIMBOLO[celula.estado]}</span>
                            {celula.pontuacao === null ? null : (
                              <span aria-hidden="true" className="font-semibold">
                                {formatarNota(celula.pontuacao)}
                              </span>
                            )}
                            {/* D10: envio queimado sem executar pede decisão do professor. */}
                            {celula.ultimoEnvioComErro ? (
                              <span aria-hidden="true" className="text-danger-500">
                                ⚠
                              </span>
                            ) : null}
                            <span className="sr-only">
                              {aluno.nome} em {exercicio.titulo}: {ROTULO_ESTADO[celula.estado]}
                              {celula.pontuacao === null ? '' : `, nota ${formatarNota(celula.pontuacao)}`}
                              {celula.ultimoEnvioComErro ? ', último envio não executou' : ''}
                            </span>
                          </Link>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <ExerciciosDificeis exercicios={painel.exercicios} dificuldade={painel.dificuldade} />
        </>
      )}
    </div>
  )
}

export default MatrizTurma
