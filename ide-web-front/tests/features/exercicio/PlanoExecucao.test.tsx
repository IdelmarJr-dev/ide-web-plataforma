import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlanoExecucao } from '../../../src/features/exercicio/components/PlanoExecucao'
import { extrairPlano } from '../../../src/features/exercicio/utils/planoExecucao'

const PLANO_PG = [
  {
    Plan: {
      'Node Type': 'Hash Join',
      'Total Cost': 35.5,
      'Plan Rows': 120,
      Plans: [
        { 'Node Type': 'Seq Scan', 'Relation Name': 'pedido', Alias: 'p', 'Total Cost': 20.1, 'Plan Rows': 1000 },
        { 'Node Type': 'Hash', Plans: [{ 'Node Type': 'Seq Scan', 'Relation Name': 'cliente', Alias: 'cliente' }] },
      ],
    },
  },
]

describe('extrairPlano', () => {
  it('converte o JSON do EXPLAIN numa árvore', () => {
    const raiz = extrairPlano(PLANO_PG)

    expect(raiz?.tipo).toBe('Hash Join')
    expect(raiz?.filhos).toHaveLength(2)
    expect(raiz?.filhos[0]).toMatchObject({ tipo: 'Seq Scan', tabela: 'pedido', alias: 'p', linhasEstimadas: 1000 })
  })

  it('devolve null para formato desconhecido', () => {
    expect(extrairPlano(null)).toBeNull()
    expect(extrairPlano({ plan: 'ok' })).toBeNull()
  })
})

describe('PlanoExecucao', () => {
  it('mostra as operações traduzidas, com tabela e alias', () => {
    render(<PlanoExecucao plano={PLANO_PG} />)

    expect(screen.getByText('Ver como o PostgreSQL executa esta consulta')).toBeInTheDocument()
    expect(screen.getByText(/Leitura sequencial \(percorre a tabela inteira\) · tabela pedido \(p\)/)).toBeInTheDocument()
    expect(screen.getByText(/Junção por hash/)).toBeInTheDocument()
  })

  it('não renderiza nada sem plano', () => {
    const { container } = render(<PlanoExecucao plano={null} />)

    expect(container).toBeEmptyDOMElement()
  })
})
