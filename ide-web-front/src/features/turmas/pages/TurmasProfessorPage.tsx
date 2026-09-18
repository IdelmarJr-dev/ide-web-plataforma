import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CriarTurmaForm } from '../components/CriarTurmaForm'
import { MinhasTurmasList } from '../components/MinhasTurmasList'

export const TurmasProfessorPage = (): ReactNode => (
  <div className="mx-auto max-w-2xl p-6">
    {/* Sem isto só dava pra sair pelo botão do navegador (Fase 9, D19). */}
    <Link to="/dashboard" className="text-sm font-medium text-primary-600 hover:underline">
      ← Voltar ao painel
    </Link>
    <h1 className="mt-3 text-xl font-semibold text-neutral-900">Turmas</h1>
    <p className="mt-1 text-sm text-neutral-600">
      Crie turmas e compartilhe o código — alunos entram direto, sem aprovação.
    </p>

    <section className="mt-6">
      <h2 className="text-base font-semibold text-neutral-900">Nova turma</h2>
      <div className="mt-2">
        <CriarTurmaForm />
      </div>
    </section>

    <section className="mt-8">
      <h2 className="text-base font-semibold text-neutral-900">Minhas turmas</h2>
      <div className="mt-2">
        <MinhasTurmasList />
      </div>
    </section>
  </div>
)

export default TurmasProfessorPage
