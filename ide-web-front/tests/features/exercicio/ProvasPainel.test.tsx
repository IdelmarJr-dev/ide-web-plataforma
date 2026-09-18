import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProvasPainel } from '../../../src/features/exercicio/components/ProvasPainel'
import { renderWithProviders } from '../../test-utils'

describe('ProvasPainel', () => {
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

  it('shows a validation error when submitted with an empty título', async () => {
    renderWithProviders(<ProvasPainel turmaId="123e4567-e89b-12d3-a456-426614174000" />)
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: /adicionar/i }))

    expect(await screen.findByText(/informe o título da prova/i)).toBeInTheDocument()
  })
})
