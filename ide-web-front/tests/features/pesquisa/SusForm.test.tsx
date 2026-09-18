import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { SusForm } from '../../../src/features/pesquisa/components/SusForm'
import { SUS_ITENS } from '../../../src/features/pesquisa/utils/susScore'
import { renderWithProviders } from '../../test-utils'
import { mockFetchPesquisa, participacao } from './pesquisaFetchMock'

describe('SusForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('não mostra o questionário antes de a tarefa ser finalizada', async () => {
    mockFetchPesquisa({
      'GET /pesquisa/minha-participacao': participacao({
        sessao: { id: 's1', iniciadaEm: '2026-09-14T10:10:00Z', finalizadaEm: null },
      }),
    })

    renderWithProviders(<SusForm />)

    expect(await screen.findByText(/este questionário não está disponível agora/i)).toBeInTheDocument()
    expect(screen.queryByText(SUS_ITENS[0] ?? '')).not.toBeInTheDocument()
  })

  it('mostra os 10 itens da versão brasileira validada, com as âncoras', async () => {
    mockFetchPesquisa({
      'GET /pesquisa/minha-participacao': participacao({
        sessao: { id: 's1', iniciadaEm: '2026-09-14T10:10:00Z', finalizadaEm: '2026-09-14T11:00:00Z' },
      }),
    })

    renderWithProviders(<SusForm />)

    expect(await screen.findByText(/eu acho que gostaria de usar esse sistema frequentemente/i)).toBeInTheDocument()
    expect(screen.getAllByRole('group')).toHaveLength(10)
    expect(screen.getAllByText('Discordo fortemente')).toHaveLength(10)
    expect(screen.getByRole('button', { name: /continuar/i })).toBeDisabled()
  })
})
