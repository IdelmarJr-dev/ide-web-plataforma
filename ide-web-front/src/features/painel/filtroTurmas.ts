import type { TurmaDoPainel } from './types'

export interface FiltroTurmasValor {
  turmaId: string
  turno: string
  sala: string
}

export const FILTRO_VAZIO: FiltroTurmasValor = { turmaId: '', turno: '', sala: '' }

/** Campo vazio não restringe nada: os três filtros se somam (Fase 10, item 10). */
export function aplicarFiltro(turmas: TurmaDoPainel[], filtro: FiltroTurmasValor): TurmaDoPainel[] {
  return turmas.filter(
    (turma) =>
      (filtro.turmaId === '' || turma.id === filtro.turmaId) &&
      (filtro.turno === '' || turma.turno === filtro.turno) &&
      (filtro.sala === '' || turma.sala === filtro.sala),
  )
}
