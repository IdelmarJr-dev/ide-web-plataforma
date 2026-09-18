import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { estudoLivreService } from '../services/estudoLivreService'
import { BancoLivre } from './BancoLivre'
import { ModelagemLivre } from './ModelagemLivre'

type Aba = 'banco' | 'modelagem' | 'exercicios'

const ROTULOS: Record<Aba, string> = {
  banco: 'Meu banco',
  modelagem: 'Modelagem',
  exercicios: 'Exercícios públicos',
}

const ExerciciosPublicos = (): ReactNode => {
  const publicosQuery = useQuery({
    queryKey: ['exercicios', 'publicos'],
    queryFn: estudoLivreService.exerciciosPublicos,
  })

  if (publicosQuery.isLoading) {
    return <p className="text-sm text-neutral-600">Carregando exercícios…</p>
  }

  if (publicosQuery.isError) {
    return (
      <p role="alert" className="text-sm text-danger-500">
        {publicosQuery.error.message}
      </p>
    )
  }

  const exercicios = publicosQuery.data ?? []

  if (exercicios.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Nenhum exercício público ainda. Professores podem publicar exercícios pra qualquer aluno resolver.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {exercicios.map((exercicio) => (
        <li key={exercicio.id} className="rounded-md border border-neutral-200 p-3">
          <Link to={`/exercicios/${exercicio.id}`} className="text-sm font-medium text-primary-600 hover:underline">
            {exercicio.titulo}
          </Link>
          <span className="ml-2 text-xs text-neutral-600">{exercicio.nivelDificuldade}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Estudo livre: o aluno pratica sem depender de código de turma nenhum. O código de
 * turma passou a servir só pra receber as atividades de um professor — ver
 * docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md.
 */
export const EstudoLivrePage = (): ReactNode => {
  const [aba, setAba] = useState<Aba>('banco')
  const [sql, setSql] = useState('')

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Estudar sozinho</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Seu próprio banco pra praticar SQL, um espaço de modelagem e os exercícios abertos — sem precisar de
            turma.
          </p>
        </div>
        <Link to="/dashboard" className="text-sm font-medium text-primary-600 hover:underline">
          Voltar
        </Link>
      </div>

      <div role="tablist" aria-label="Seções do estudo livre" className="mt-6 flex gap-1 border-b border-neutral-200">
        {(Object.keys(ROTULOS) as Aba[]).map((chave) => (
          <button
            key={chave}
            type="button"
            role="tab"
            aria-selected={aba === chave}
            onClick={() => {
              setAba(chave)
            }}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              aba === chave
                ? 'border-primary-500 font-medium text-primary-600'
                : 'border-transparent text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {ROTULOS[chave]}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {aba === 'banco' ? <BancoLivre sql={sql} onSqlChange={setSql} /> : null}
        {aba === 'modelagem' ? (
          <ModelagemLivre
            onUsarSql={(sqlDoModelo) => {
              setSql(sqlDoModelo)
              setAba('banco')
            }}
          />
        ) : null}
        {aba === 'exercicios' ? <ExerciciosPublicos /> : null}
      </div>
    </div>
  )
}

export default EstudoLivrePage
