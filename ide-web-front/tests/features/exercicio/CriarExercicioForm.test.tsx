import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CriarExercicioForm } from '../../../src/features/exercicio/components/CriarExercicioForm'
import { renderWithProviders } from '../../test-utils'

describe('CriarExercicioForm', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Fase 9, D15: o professor publicava exercício sem gabarito sem saber que isso desliga
  // a correção automática.
  it('avisa que sem gabarito SQL a correção é manual', async () => {
    renderWithProviders(<CriarExercicioForm turmaId="123e4567-e89b-12d3-a456-426614174000" />)

    expect(await screen.findByText(/sem gabarito sql não há correção automática/i)).toBeInTheDocument()
  })

  it('esconde o aviso assim que o gabarito é preenchido', async () => {
    renderWithProviders(<CriarExercicioForm turmaId="123e4567-e89b-12d3-a456-426614174000" />)
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText(/gabarito sql/i), 'SELECT 1')

    expect(screen.queryByText(/sem gabarito sql não há correção automática/i)).not.toBeInTheDocument()
  })

  // Fase 9, D21: o botão fica no fim de um formulário longo e o erro aparecia no topo,
  // fora da tela — o clique parecia não fazer nada.
  it('leva o foco ao primeiro campo inválido ao submeter vazio', async () => {
    renderWithProviders(<CriarExercicioForm turmaId="123e4567-e89b-12d3-a456-426614174000" />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /criar exercício/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/título/i)).toHaveFocus()
    })
  })
})
