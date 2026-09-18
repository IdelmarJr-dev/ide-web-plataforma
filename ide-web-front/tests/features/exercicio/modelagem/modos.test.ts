import { describe, expect, it } from 'vitest'
import { MODOS_MODELAGEM } from '~features/exercicio/modelagem/documento'
import { modoDoExercicio, ROTULOS_MODO_MODELAGEM } from '~features/exercicio/modelagem/modos'

describe('modos da modelagem', () => {
  it('tem os três níveis, todos definidos pelo professor', () => {
    expect(MODOS_MODELAGEM).toEqual(['conceitual', 'logico', 'conceitual_logico'])
    expect(Object.keys(ROTULOS_MODO_MODELAGEM)).toHaveLength(3)
  })

  it('devolve o nível guardado no exercício', () => {
    expect(modoDoExercicio('conceitual')).toBe('conceitual')
    expect(modoDoExercicio('logico')).toBe('logico')
    expect(modoDoExercicio('conceitual_logico')).toBe('conceitual_logico')
  })

  it('cai no percurso completo quando o exercício traz um nível que não existe mais', () => {
    expect(modoDoExercicio('aluno_escolhe')).toBe('conceitual_logico')
    expect(modoDoExercicio('')).toBe('conceitual_logico')
  })
})
