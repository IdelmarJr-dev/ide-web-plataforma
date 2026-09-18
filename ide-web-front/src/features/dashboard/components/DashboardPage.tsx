import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '~components/Button/Button'
import { useAuth } from '~features/auth/context/authContext'
import { PainelAluno, PainelProfessor } from '~features/painel'

/**
 * O dashboard é só o roteador por papel: cada painel mora na feature `painel`.
 * O pesquisador continua com o atalho simples — a área dele é `/admin/pesquisa`.
 */
const PainelPesquisador = (): ReactNode => (
  <Link
    to="/admin/pesquisa"
    className="block rounded-lg border border-neutral-300 bg-white p-4 transition-colors hover:border-primary-400
      hover:bg-primary-50/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
  >
    <span className="text-sm font-semibold text-neutral-900">Pesquisa</span>
    <span className="mt-1 block text-xs text-neutral-600">
      Escolher os exercícios da tarefa, acompanhar participantes, sortear grupos e exportar os dados.
    </span>
  </Link>
)

export const DashboardPage = (): ReactNode => {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = (): void => {
    // erro de logout não bloqueia a navegação — os cookies já são limpos no backend
    logout()
      .then(() => {
        void navigate('/login')
      })
      .catch(() => undefined)
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold text-neutral-900">Olá, {usuario?.nome}</h1>
        <Button variant="ghost" onClick={handleLogout}>
          Sair
        </Button>
      </div>

      <div className="mt-8">
        {usuario?.papel === 'professor' ? <PainelProfessor /> : null}
        {usuario?.papel === 'aluno' ? <PainelAluno /> : null}
        {usuario?.papel === 'pesquisador' ? <PainelPesquisador /> : null}
      </div>
    </div>
  )
}

export default DashboardPage
