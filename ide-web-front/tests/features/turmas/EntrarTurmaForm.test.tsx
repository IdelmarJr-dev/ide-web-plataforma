import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EntrarTurmaForm } from '../../../src/features/turmas/components/EntrarTurmaForm'
import { renderWithProviders } from '../../test-utils'

function respostaDeErro(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('EntrarTurmaForm', () => {
  beforeEach(() => {
    // Uma Response nova por chamada: o corpo só pode ser lido uma vez.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(respostaDeErro(404, 'NOT_FOUND', 'Turma não encontrada'))),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('cobra o código da turma quando o campo está vazio', async () => {
    renderWithProviders(<EntrarTurmaForm />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /entrar na turma/i }))

    expect(await screen.findByText(/informe o código da turma/i)).toBeInTheDocument()
  })

  // O código é matrícula, não credencial: não se pede mais nome nem código pessoal,
  // porque o aluno já chega logado (Fase 8).
  it('pede só o código — nome e código pessoal saíram do formulário', async () => {
    renderWithProviders(<EntrarTurmaForm />)

    expect(screen.getByLabelText(/código da turma/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/seu nome/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/código pessoal/i)).not.toBeInTheDocument()
  })

  it('mostra a mensagem do servidor quando o código não existe', async () => {
    renderWithProviders(<EntrarTurmaForm />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/código da turma/i), 'ABC123')
    await user.click(screen.getByRole('button', { name: /entrar na turma/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/turma não encontrada/i)
  })

  it('confirma a entrada quando a matrícula dá certo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ data: { id: 'turma-1', nome: 'Banco de Dados', codigo: 'ABC123' } }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    )
    renderWithProviders(<EntrarTurmaForm />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/código da turma/i), 'abc123')
    await user.click(screen.getByRole('button', { name: /entrar na turma/i }))

    expect(await screen.findByText(/você entrou em banco de dados/i)).toBeInTheDocument()
  })
})
