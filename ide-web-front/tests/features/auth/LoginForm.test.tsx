import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../../../src/features/auth/components/LoginForm'
import { renderWithProviders } from '../../test-utils'

describe('LoginForm', () => {
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
    renderWithProviders(<LoginForm />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText(/informe um e-mail válido/i)).toBeInTheDocument()
    expect(screen.getByText(/informe sua senha/i)).toBeInTheDocument()
  })

  it('does not show validation errors for a well-formed submission', async () => {
    renderWithProviders(<LoginForm />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/e-mail/i), 'aluno@exemplo.com')
    await user.type(screen.getByLabelText('Senha'), 'senha-super-secreta')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(screen.queryByText(/informe um e-mail válido/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/informe sua senha/i)).not.toBeInTheDocument()
  })
})
