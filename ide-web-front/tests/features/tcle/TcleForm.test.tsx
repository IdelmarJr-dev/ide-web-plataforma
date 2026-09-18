import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { TcleForm } from '../../../src/features/tcle/components/TcleForm'
import { CONTATO_PESQUISADOR } from '../../../src/features/tcle/components/TermoTexto'
import { renderWithProviders } from '../../test-utils'
import { mockFetchPesquisa } from '../pesquisa/pesquisaFetchMock'

describe('TcleForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mostra o termo (Apêndice A), o contato do pesquisador e as duas opções', () => {
    mockFetchPesquisa({})

    renderWithProviders(<TcleForm />)

    expect(screen.getByText(/você está sendo convidado/i)).toBeInTheDocument()
    expect(screen.getByText(/IDE Web para o Ensino de Banco de Dados/i)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(CONTATO_PESQUISADOR))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /li e aceito participar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /não quero participar/i })).toBeInTheDocument()
  })
})
