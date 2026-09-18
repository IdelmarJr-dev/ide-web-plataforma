import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export const LandingFooter = (): ReactNode => {
  return (
    <footer className="border-t border-neutral-200 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 text-sm text-neutral-600 sm:flex-row sm:justify-between">
        <span>IDE Web — projeto de pesquisa acadêmica (TCC).</span>
        <Link to="/politica-de-privacidade" className="font-medium text-primary-600 hover:underline">
          Política de privacidade
        </Link>
      </div>
    </footer>
  )
}

export default LandingFooter
