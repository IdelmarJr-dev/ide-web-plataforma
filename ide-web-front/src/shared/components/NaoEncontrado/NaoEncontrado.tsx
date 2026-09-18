import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '~features/auth/context/authContext'

/** Rota inexistente (link quebrado, favorito antigo, URL digitada errada). */
export const NaoEncontrado = (): ReactNode => {
  const { usuario } = useAuth()
  const destino = usuario ? '/dashboard' : '/login'

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-3 p-8">
      <p className="text-sm font-semibold text-primary-600">Erro 404</p>
      <h1 className="text-xl font-semibold text-neutral-900">Esta página não existe</h1>
      <p className="text-sm text-neutral-600">
        O endereço pode ter sido digitado errado ou a página pode ter mudado de lugar.
      </p>
      <Link
        to={destino}
        className="w-fit rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700
          focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
      >
        {usuario ? 'Voltar ao início' : 'Ir para o login'}
      </Link>
    </main>
  )
}

export default NaoEncontrado
