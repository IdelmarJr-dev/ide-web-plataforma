import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TopNav } from '~components/TopNav/TopNav'
import { useAuth } from '~features/auth/context/authContext'
import { PainelAluno, PainelProfessor } from '~features/painel'

/**
 * O dashboard é só o roteador por papel: cada painel mora na feature `painel`.
 * O pesquisador continua com o atalho simples — a área dele é `/admin/pesquisa`.
 */
const PainelPesquisador = (): ReactNode => (
  <Link
    to="/admin/pesquisa"
    className="block rounded-lg border border-neutral-300 bg-surface p-4 transition-colors hover:border-primary-400
      hover:bg-primary-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
  >
    <span className="text-sm font-semibold text-neutral-900">Pesquisa</span>
    <span className="mt-1 block text-xs text-neutral-600">
      Escolher os exercícios da tarefa, acompanhar participantes, sortear grupos e exportar os dados.
    </span>
  </Link>
)

export const DashboardPage = (): ReactNode => {
  const { usuario } = useAuth()

  return (
    <div className="min-h-screen bg-neutral-50">
      <TopNav />

      <div className="mx-auto max-w-5xl p-6">
        <h1 className="font-mono text-sm text-neutral-500">-- olá, {usuario?.nome}. bem-vindo de volta.</h1>

        <div className="mt-6 flex flex-col gap-6">
          {usuario?.papel === 'pesquisador' ? <PainelPesquisador /> : null}
          {usuario?.papel === 'professor' || usuario?.papel === 'pesquisador' ? <PainelProfessor /> : null}
          {usuario?.papel === 'aluno' ? <PainelAluno /> : null}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
