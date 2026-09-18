import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
// Import concreto, não pelo índice: `~features/pesquisa` e `~features/turmas` exportam
// páginas que carregam o Monaco, e o painel não precisa dele. Também deixa a remoção do
// banner pós-coleta numa linha só (CLAUDE.md; Fase 9, D7 e D9).
import { PesquisaBanner } from '~features/pesquisa/components/PesquisaBanner'
import { EntrarTurmaForm } from '~features/turmas/components/EntrarTurmaForm'
import { usePainelAluno } from '../hooks/usePainel'
import { CartaoResumo } from './CartaoResumo'
import { ListaExercicios } from './ListaExercicios'

export const PainelAluno = (): ReactNode => {
  const painelQuery = usePainelAluno()
  const painel = painelQuery.data

  const ativas = painel?.disciplinas ?? []

  return (
    <div className="flex flex-col gap-8">
      {/*
        Primeiro elemento, comportamento intocado: é o gatilho que leva o participante
        ao TCLE, e reorganizar a tela não pode mexer nesse caminho (Fase 9, D7).
      */}
      <PesquisaBanner />

      {painelQuery.isLoading ? <p className="text-sm text-neutral-600">Carregando seu painel…</p> : null}

      {painelQuery.isError ? (
        <p role="alert" className="text-sm text-danger-500">
          {painelQuery.error.message}
        </p>
      ) : null}

      {painel ? (
        <>
          <section aria-label="Resumo">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CartaoResumo rotulo="Turmas" valor={painel.resumo.turmas} />
              <CartaoResumo rotulo="Falta fazer" valor={painel.resumo.pendentes} destaque />
              <CartaoResumo rotulo="Entregues" valor={painel.resumo.entregues} />
              <CartaoResumo rotulo="Acertos automáticos" valor={painel.resumo.acertos} />
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-neutral-900">O que falta fazer</h2>
            <p className="mt-1 text-xs text-neutral-600">De todas as suas turmas, num lugar só.</p>
            <div className="mt-2">
              <ListaExercicios
                exercicios={painel.pendencias}
                mostrarTurma
                vazio="Você está em dia com todas as turmas."
              />
            </div>
          </section>

          {ativas.length === 0 ? (
            <p className="text-sm text-neutral-600">
              Você ainda não está em nenhuma turma. Estudar sozinho não exige turma — o código serve pra receber as
              atividades de um professor.
            </p>
          ) : null}

          {ativas.map((grupo) => (
            <section key={grupo.disciplina}>
              <h2 className="text-base font-semibold text-neutral-900">{grupo.disciplina}</h2>
              <div className="mt-2 flex flex-col gap-4">
                {grupo.turmas.map((turma) => (
                  <div key={turma.id}>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <h3 className="text-sm font-semibold text-neutral-900">{turma.nome}</h3>
                      <span className="text-xs text-neutral-600">{turma.semestre}</span>
                      {turma.encerradaEm === null ? null : (
                        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-700">
                          Encerrada
                        </span>
                      )}
                    </div>
                    {turma.encerradaEm === null ? null : (
                      <p className="mt-1 text-xs text-neutral-600">
                        Turma encerrada. Você continua vendo tudo o que entregou, mas não envia mais nada.
                      </p>
                    )}
                    <div className="mt-2">
                      <ListaExercicios exercicios={turma.exercicios} vazio="Nenhum exercício nesta turma ainda." />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section>
            <h2 className="text-base font-semibold text-neutral-900">O que você já entregou</h2>
            <div className="mt-2">
              <ListaExercicios
                exercicios={painel.historico}
                mostrarTurma
                vazio="Nada entregue ainda — o que você finalizar aparece aqui."
              />
            </div>
          </section>

          {painel.progresso.tentativasAteAcertar.length === 0 ? null : (
            <section>
              <h2 className="text-base font-semibold text-neutral-900">Seu progresso</h2>
              <p className="mt-1 text-xs text-neutral-600">
                Em que tentativa você acertou cada exercício. A comparação é com você mesmo ao longo do tempo.
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {painel.progresso.tentativasAteAcertar.map((item) => (
                  <li key={item.exercicioId} className="text-sm text-neutral-700">
                    {item.titulo}: acertou na <strong>{item.tentativas}ª tentativa</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : null}

      <section className="rounded-md border border-neutral-200 p-4">
        <p className="mb-3 text-xs text-neutral-600">
          Seu próprio banco pra praticar SQL, espaço de modelagem e os exercícios abertos — sem turma.
        </p>
        <Link to="/estudar" className="text-sm font-semibold text-primary-600 hover:underline">
          Estudar sozinho
        </Link>
      </section>

      <section className="rounded-md border border-neutral-200 p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Entrar em uma turma</h2>
        <p className="mb-3 mt-1 text-xs text-neutral-600">
          Com o código que o professor compartilhou. Você fica na turma até ele encerrá-la.
        </p>
        <EntrarTurmaForm />
      </section>
    </div>
  )
}
