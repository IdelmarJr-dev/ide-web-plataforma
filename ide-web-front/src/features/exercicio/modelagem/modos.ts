import { MODOS_MODELAGEM } from './documento'
import type { ModoModelagem } from './documento'

export const ROTULOS_MODO_MODELAGEM: Record<ModoModelagem, string> = {
  conceitual: 'Conceitual (diagrama entidade-relacionamento)',
  logico: 'Lógico (tabelas e chaves)',
  conceitual_logico: 'Conceitual → Lógico (converter e ajustar)',
}

/**
 * Nível da modelagem guardado no exercício (`modo_mer`), definido pelo professor. O valor
 * chega do servidor, e o banco já teve um modo "aluno escolhe", retirado depois: qualquer
 * valor desconhecido cai no percurso completo, que é o padrão dos exercícios novos.
 */
export function modoDoExercicio(valor: string): ModoModelagem {
  return (MODOS_MODELAGEM as readonly string[]).includes(valor) ? (valor as ModoModelagem) : 'conceitual_logico'
}
