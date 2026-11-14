import { describe, expect, it } from 'vitest'
import { textoDaDica } from '../../../src/features/dica-ia/utils/textoDaDica'

describe('textoDaDica', () => {
  it('tira negrito, código e título em Markdown sem mudar o texto', () => {
    const resposta = '## Dica\nVerifique a tabela **pedido** e a cláusula `GROUP BY`, e __agrupe__ por cliente.'

    expect(textoDaDica(resposta)).toBe('Dica\nVerifique a tabela pedido e a cláusula GROUP BY, e agrupe por cliente.')
  })

  it('deixa como está a dica sem Markdown, incluindo o asterisco do COUNT(*)', () => {
    const resposta = 'Use COUNT(*) e pense em qual coluna agrupar.'

    expect(textoDaDica(resposta)).toBe(resposta)
  })
})
