import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultadoSandbox } from '../../../src/features/exercicio/components/SandboxPainel'
import type { SandboxEnvioResultado } from '../../../src/features/exercicio/types'

function envio(correta: boolean | null): SandboxEnvioResultado {
  return {
    status: 'sucesso',
    rows: [{ id: 1 }],
    correta,
    submissaoId: 'submissao-1',
    tentativaNumero: 1,
    plano: null,
  }
}

describe('ResultadoSandbox', () => {
  it('diz que acertou quando o gabarito bate', () => {
    render(<ResultadoSandbox resultado={envio(true)} />)

    expect(screen.getByText('Resposta correta.')).toBeInTheDocument()
  })

  it('diz que errou quando o gabarito não bate', () => {
    render(<ResultadoSandbox resultado={envio(false)} />)

    expect(screen.getByText('Resposta incorreta.')).toBeInTheDocument()
  })

  // Fase 9, D15: sem gabarito a tela não dizia nada, e o aluno lia a tabela sem erro
  // como "acertei". O silêncio era o defeito.
  it('avisa que a correção é manual quando o exercício não tem gabarito SQL', () => {
    render(<ResultadoSandbox resultado={envio(null)} />)

    expect(screen.getByText('Resposta enviada. Este exercício será corrigido pelo professor.')).toBeInTheDocument()
    expect(screen.queryByText('Resposta correta.')).not.toBeInTheDocument()
    expect(screen.queryByText('Resposta incorreta.')).not.toBeInTheDocument()
  })

  it('não mostra veredito nenhum ao apenas testar a consulta', () => {
    render(<ResultadoSandbox resultado={{ status: 'sucesso', rows: [{ id: 1 }] }} />)

    expect(screen.queryByText(/Resposta/)).not.toBeInTheDocument()
  })
})
