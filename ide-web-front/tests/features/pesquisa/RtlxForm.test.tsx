import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RtlxForm } from '../../../src/features/pesquisa/components/RtlxForm'
import { RTLX_DIMENSOES } from '../../../src/features/pesquisa/utils/rtlxScore'
import { renderWithProviders } from '../../test-utils'
import { mockFetchPesquisa, participacao } from './pesquisaFetchMock'

const PRONTO_PARA_RTLX = participacao({
  sessao: { id: 's1', iniciadaEm: '2026-09-14T10:10:00Z', finalizadaEm: '2026-09-14T11:00:00Z' },
  susRespondido: true,
})

describe('RtlxForm', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('não mostra o questionário antes do SUS', async () => {
    mockFetchPesquisa({ 'GET /pesquisa/minha-participacao': participacao() })

    renderWithProviders(<RtlxForm />)

    expect(await screen.findByText(/este questionário não está disponível agora/i)).toBeInTheDocument()
  })

  it('usa a escala de 0 a 100 em passos de 5, sem nada pré-marcado', async () => {
    mockFetchPesquisa({ 'GET /pesquisa/minha-participacao': PRONTO_PARA_RTLX })

    renderWithProviders(<RtlxForm />)

    expect(await screen.findByText(/quão mentalmente exigente foi a tarefa/i)).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(RTLX_DIMENSOES.length * 21)
    expect(radios.every((radio) => !(radio as HTMLInputElement).checked)).toBe(true)
    expect(screen.getAllByText('Não respondido')).toHaveLength(6)
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled()
  })

  it('só envia com as 6 dimensões respondidas', async () => {
    const chamadas = mockFetchPesquisa({
      'GET /pesquisa/minha-participacao': PRONTO_PARA_RTLX,
      'POST /sessoes/s1/rtlx': { id: 'r1', sessaoId: 's1', pontuacaoRtlx: '50.00' },
    })
    const user = userEvent.setup()

    renderWithProviders(<RtlxForm />)
    await screen.findByText(/quão mentalmente exigente foi a tarefa/i)

    for (const dimensao of RTLX_DIMENSOES.slice(0, 5)) {
      await user.click(screen.getByRole('radio', { name: `${dimensao.titulo}: 50` }))
    }
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled()

    const ultima = RTLX_DIMENSOES[5]
    if (!ultima) throw new Error('dimensão ausente')
    await user.click(screen.getByRole('radio', { name: `${ultima.titulo}: 50` }))
    await user.click(screen.getByRole('button', { name: /enviar/i }))

    await waitFor(() => {
      const envio = chamadas.find((chamada) => chamada.caminho === '/sessoes/s1/rtlx')
      expect(envio?.corpo).toMatchObject({ pontuacaoRtlx: 50 })
    })
  })
})
