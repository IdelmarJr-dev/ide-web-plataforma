import type { ReactNode } from 'react'

interface PageStubProps {
  title: string
  description: string
  children?: ReactNode
}

/**
 * Placeholder de página para rotas cujo domínio ainda não existe no backend
 * (ver docs/decisions/fase1-setup-tecnico.md — escopo da Fase 1).
 */
export const PageStub = ({ title, description, children }: PageStubProps): ReactNode => {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
      <p className="mt-2 text-sm text-neutral-600">{description}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  )
}

export default PageStub
