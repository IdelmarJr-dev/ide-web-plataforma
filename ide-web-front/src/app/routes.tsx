import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useRoutes } from 'react-router-dom'
import { useAuth } from '~features/auth/context/authContext'
import { AuthGuard } from '~components/AuthGuard/AuthGuard'
import { NaoEncontrado } from '~components/NaoEncontrado/NaoEncontrado'

const LoginPage = lazy(() => import('~features/auth').then((module) => ({ default: module.LoginPage })))
const RegistroPage = lazy(() => import('~features/auth').then((module) => ({ default: module.RegistroPage })))
const PoliticaPrivacidadePage = lazy(() =>
  import('~features/legal').then((module) => ({ default: module.PoliticaPrivacidadePage })),
)
const TclePage = lazy(() => import('~features/tcle').then((module) => ({ default: module.TclePage })))
const DashboardPage = lazy(() => import('~features/dashboard').then((module) => ({ default: module.DashboardPage })))
const EstudoLivrePage = lazy(() =>
  import('~features/estudo-livre').then((module) => ({ default: module.EstudoLivrePage })),
)
const ExercicioPage = lazy(() => import('~features/exercicio').then((module) => ({ default: module.ExercicioPage })))
const ResultadoPage = lazy(() => import('~features/exercicio').then((module) => ({ default: module.ResultadoPage })))
const RevisaoTurmaPage = lazy(() =>
  import('~features/exercicio').then((module) => ({ default: module.RevisaoTurmaPage })),
)
const RevisaoAlunoPage = lazy(() =>
  import('~features/exercicio').then((module) => ({ default: module.RevisaoAlunoPage })),
)
const SusPage = lazy(() => import('~features/pesquisa').then((module) => ({ default: module.SusPage })))
const RtlxPage = lazy(() => import('~features/pesquisa').then((module) => ({ default: module.RtlxPage })))
const SessaoPesquisaPage = lazy(() =>
  import('~features/pesquisa').then((module) => ({ default: module.SessaoPesquisaPage })),
)
const AdminTurmasPage = lazy(() => import('~features/admin').then((module) => ({ default: module.AdminTurmasPage })))
const MatrizTurma = lazy(() => import('~features/painel').then((module) => ({ default: module.MatrizTurma })))
const RevisaoAluno = lazy(() => import('~features/painel').then((module) => ({ default: module.RevisaoAluno })))
const AdminPesquisaPage = lazy(() =>
  import('~features/admin').then((module) => ({ default: module.AdminPesquisaPage })),
)

const RootRedirect = (): ReactNode => {
  const { usuario, isLoading } = useAuth()

  if (isLoading) {
    return <p className="p-6 text-sm text-neutral-600">Carregando…</p>
  }

  return <Navigate to={usuario ? '/dashboard' : '/login'} replace />
}

export const AppRoutes = (): ReactNode => {
  const element = useRoutes([
    { path: '/', element: <RootRedirect /> },
    { path: '/login', element: <LoginPage /> },
    { path: '/registro', element: <RegistroPage /> },
    { path: '/politica-de-privacidade', element: <PoliticaPrivacidadePage /> },
    {
      path: '/tcle',
      element: (
        <AuthGuard roles={['aluno']}>
          <TclePage />
        </AuthGuard>
      ),
    },
    {
      path: '/pesquisa/sessao',
      element: (
        <AuthGuard roles={['aluno']}>
          <SessaoPesquisaPage />
        </AuthGuard>
      ),
    },
    {
      path: '/dashboard',
      element: (
        <AuthGuard>
          <DashboardPage />
        </AuthGuard>
      ),
    },
    {
      path: '/estudar',
      element: (
        <AuthGuard roles={['aluno']}>
          <EstudoLivrePage />
        </AuthGuard>
      ),
    },
    {
      path: '/exercicios/:id',
      element: (
        <AuthGuard>
          <ExercicioPage />
        </AuthGuard>
      ),
    },
    {
      path: '/exercicios/:id/resultado',
      element: (
        <AuthGuard>
          <ResultadoPage />
        </AuthGuard>
      ),
    },
    {
      path: '/pesquisa/sus',
      element: (
        <AuthGuard roles={['aluno']}>
          <SusPage />
        </AuthGuard>
      ),
    },
    {
      path: '/pesquisa/rtlx',
      element: (
        <AuthGuard roles={['aluno']}>
          <RtlxPage />
        </AuthGuard>
      ),
    },
    {
      path: '/admin/turmas',
      element: (
        <AuthGuard roles={['professor', 'pesquisador']}>
          <AdminTurmasPage />
        </AuthGuard>
      ),
    },
    {
      path: '/admin/pesquisa',
      element: (
        <AuthGuard roles={['pesquisador']}>
          <AdminPesquisaPage />
        </AuthGuard>
      ),
    },
    // A revisão é da pessoa, não de uma questão solta (Fase 10, D4).
    {
      path: '/admin/turmas/:turmaId/alunos/:usuarioId',
      element: (
        <AuthGuard roles={['professor', 'pesquisador']}>
          <RevisaoAluno />
        </AuthGuard>
      ),
    },
    // Matriz aluno × exercício da turma (Fase 9, D2).
    {
      path: '/admin/turmas/:turmaId/painel',
      element: (
        <AuthGuard roles={['professor', 'pesquisador']}>
          <MatrizTurma />
        </AuthGuard>
      ),
    },
    {
      path: '/admin/turmas/:turmaId/exercicios/:exercicioId/revisar',
      element: (
        <AuthGuard roles={['professor', 'pesquisador']}>
          <RevisaoTurmaPage />
        </AuthGuard>
      ),
    },
    {
      path: '/admin/turmas/:turmaId/exercicios/:exercicioId/revisar/:usuarioId',
      element: (
        <AuthGuard roles={['professor', 'pesquisador']}>
          <RevisaoAlunoPage />
        </AuthGuard>
      ),
    },
    // Coringa: sem ela, uma URL desconhecida renderiza tela em branco.
    { path: '*', element: <NaoEncontrado /> },
  ])

  return <Suspense fallback={<p className="p-6 text-sm text-neutral-600">Carregando…</p>}>{element}</Suspense>
}

export default AppRoutes
