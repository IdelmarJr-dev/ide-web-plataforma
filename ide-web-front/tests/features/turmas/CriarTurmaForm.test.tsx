import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CriarTurmaForm } from '../../../src/features/turmas/components/CriarTurmaForm'
import { renderWithProviders } from '../../test-utils'

describe('CriarTurmaForm', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Autenticação necessária' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows validation errors when submitted with empty fields', async () => {
    renderWithProviders(<CriarTurmaForm />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /criar turma/i }))

    expect(await screen.findByText(/informe o nome da turma/i)).toBeInTheDocument()
    expect(screen.getByText(/informe o semestre/i)).toBeInTheDocument()
  })

  it('does not show validation errors for a well-formed submission', async () => {
    renderWithProviders(<CriarTurmaForm />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/nome da turma/i), 'Turma A')
    await user.type(screen.getByLabelText(/semestre/i), '2026.2')
    await user.click(screen.getByRole('button', { name: /criar turma/i }))

    expect(screen.queryByText(/informe o nome da turma/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/informe o semestre/i)).not.toBeInTheDocument()
  })

  // Fase 9, D18: "Banco de Dados" era placeholder cinza e virava o valor gravado sem
  // o professor ver. Como valor inicial, o que vai ser salvo está à vista e editável.
  it('mostra a disciplina padrão como valor de verdade, não como placeholder', () => {
    renderWithProviders(<CriarTurmaForm />)

    expect(screen.getByLabelText(/disciplina/i)).toHaveValue('Banco de Dados')
  })

  it('envia a disciplina que o professor digitou por cima do padrão', async () => {
    renderWithProviders(<CriarTurmaForm />)
    const user = userEvent.setup()

    const disciplina = screen.getByLabelText(/disciplina/i)
    await user.clear(disciplina)
    await user.type(disciplina, 'Engenharia de Software')
    await user.type(screen.getByLabelText(/nome da turma/i), 'Turma A')
    await user.type(screen.getByLabelText(/semestre/i), '2026.2')
    await user.click(screen.getByRole('button', { name: /criar turma/i }))

    // A chamada de criação, não a última: com 401 o httpClient ainda tenta /auth/refresh.
    const criacao = vi.mocked(fetch).mock.calls.find((chamada) => String(chamada[0]).endsWith('/turmas'))
    expect(String(criacao?.[1]?.body)).toContain('Engenharia de Software')
  })
})
