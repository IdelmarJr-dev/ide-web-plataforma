import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { exercicioService } from '../services/exercicioService'

export const ResultadoPage = (): ReactNode => {
  const { id } = useParams<{ id: string }>()

  const resultadoQuery = useQuery({
    queryKey: ['exercicios', id, 'resultado'],
    queryFn: () => exercicioService.meuResultado(id ?? ''),
    enabled: id !== undefined,
  })

  const voltar = (
    <Link to="/dashboard" className="text-sm font-medium text-primary-600 hover:underline">
      ← Voltar ao painel
    </Link>
  )

  if (resultadoQuery.isLoading) {
    return (
      <div className="mx-auto max-w-md p-6">
        {voltar}
        <p className="mt-3 text-sm text-neutral-600">Carregando resultado…</p>
      </div>
    )
  }

  if (resultadoQuery.isError) {
    return (
      <div className="mx-auto max-w-md p-6">
        {voltar}
        <p role="alert" className="mt-3 text-sm text-danger-500">
          Não foi possível carregar o resultado.
        </p>
      </div>
    )
  }

  const resultado = resultadoQuery.data

  if (!resultado) {
    return (
      <div className="mx-auto max-w-md p-6">
        {voltar}
        <h1 className="mt-3 text-lg font-semibold text-neutral-900">Resultado</h1>
        <p className="mt-2 text-sm text-neutral-600">
          O professor ainda não liberou o gabarito deste exercício.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md p-6">
      {voltar}
      <h1 className="mt-3 text-lg font-semibold text-neutral-900">Resultado</h1>
      <dl className="mt-4 flex flex-col gap-2 text-sm text-neutral-700">
        {resultado.sqlCorreto !== null ? (
          <div className="flex justify-between">
            <dt>SQL</dt>
            <dd>{resultado.sqlCorreto ? 'Correto' : 'Incorreto'}</dd>
          </div>
        ) : null}
        {resultado.merAvaliacao !== null ? (
          <div className="flex justify-between">
            <dt>Diagrama MER</dt>
            <dd>{resultado.merAvaliacao}</dd>
          </div>
        ) : null}
        {resultado.dissertativaAvaliacao !== null ? (
          <div className="flex justify-between">
            <dt>Dissertativa</dt>
            <dd>{resultado.dissertativaAvaliacao}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt>Acertos</dt>
          <dd>{resultado.acertos}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Erros</dt>
          <dd>{resultado.erros}</dd>
        </div>
        {resultado.pontuacao !== null ? (
          <div className="flex justify-between font-semibold text-neutral-900">
            <dt>Pontuação</dt>
            <dd>{resultado.pontuacao}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}

export default ResultadoPage
