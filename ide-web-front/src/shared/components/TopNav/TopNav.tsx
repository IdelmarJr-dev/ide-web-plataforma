import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '~features/auth/context/authContext'
import type { Papel } from '~features/auth/types'

interface NavLink {
  rotulo: string
  para: string
}

// Um item por tela de nível raiz que o papel pode acessar direto (sem passar por um card/link
// de outra tela) — o resto (turma específica, exercício, revisão de um aluno) é navegação em
// profundidade e continua vivendo dentro da própria tela de origem.
const LINKS_POR_PAPEL: Record<Papel, NavLink[]> = {
  aluno: [
    { rotulo: 'Painel', para: '/dashboard' },
    { rotulo: 'Estudar sozinho', para: '/estudar' },
  ],
  professor: [
    { rotulo: 'Painel', para: '/dashboard' },
    { rotulo: 'Turmas', para: '/admin/turmas' },
  ],
  pesquisador: [
    { rotulo: 'Painel', para: '/dashboard' },
    { rotulo: 'Turmas', para: '/admin/turmas' },
    { rotulo: 'Pesquisa', para: '/admin/pesquisa' },
  ],
}

function ehAtivo(pathname: string, para: string): boolean {
  if (para === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(para)
}

/** Barra de navegação da home autenticada — logo, telas de nível raiz do papel e a conta.
 * À direita reserva espaço (`pr-14`) pro botão de tema fixo (`BotaoTema`, em App.tsx), do
 * mesmo jeito que ExercicioPage/EstudoLivrePage já fazem pro mesmo botão. */
export const TopNav = (): ReactNode => {
  const { usuario, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  if (!usuario) return null

  const links = LINKS_POR_PAPEL[usuario.papel]
  const inicial = usuario.nome.trim().charAt(0).toUpperCase() || '?'

  const handleLogout = (): void => {
    // erro de logout não bloqueia a navegação — os cookies já são limpos no backend
    logout()
      .then(() => {
        void navigate('/login')
      })
      .catch(() => undefined)
  }

  return (
    <nav className="flex h-16 items-center border-b border-neutral-200 bg-surface px-6 pr-14">
      <Link to="/dashboard" className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-600 font-mono text-sm
            font-bold text-white"
        >
          &gt;
        </span>
        <span className="font-mono text-sm font-bold tracking-tight text-neutral-900">IDE Web</span>
      </Link>

      <div className="ml-8 flex items-center gap-1">
        {links.map((link) => (
          <Link
            key={link.para}
            to={link.para}
            className={`rounded-md px-3 py-1.5 font-mono text-sm font-medium transition-colors ${
              ehAtivo(pathname, link.para)
                ? 'bg-neutral-100 text-neutral-900'
                : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
            }`}
          >
            {link.rotulo}
          </Link>
        ))}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-xs
              font-bold text-neutral-800"
          >
            {inicial}
          </span>
          <span className="text-sm font-medium text-neutral-700">{usuario.nome}</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
        >
          Sair
        </button>
      </div>
    </nav>
  )
}

export default TopNav
