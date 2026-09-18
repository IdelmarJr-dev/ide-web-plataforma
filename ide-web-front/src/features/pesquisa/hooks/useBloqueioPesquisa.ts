import { useAuth } from '~features/auth/context/authContext'
import { useMinhaParticipacao } from './useMinhaParticipacao'

/**
 * Durante a pesquisa, o grupo controle usa as ferramentas tradicionais — a IDE Web
 * (editor, sandbox, dicas) fica bloqueada pra ele. Bloqueio só no frontend: a coleta
 * é supervisionada em laboratório (docs/decisions/fase6-alinhamento-tcc.md).
 */
export function useBloqueioPesquisa(): { bloqueado: boolean } {
  const { usuario } = useAuth()
  const ehAluno = usuario?.papel === 'aluno'
  const participacao = useMinhaParticipacao(ehAluno)

  const dados = participacao.data
  return { bloqueado: ehAluno && dados?.pesquisa !== null && dados?.pesquisa !== undefined && dados.grupo === 'controle' }
}
