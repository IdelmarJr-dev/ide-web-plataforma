import { httpClient } from '../../../lib/httpClient'
import type {
  Exportacao,
  MinhaParticipacao,
  Participantes,
  Pesquisa,
  PesquisaStatus,
  Sessao,
  SorteioResultado,
  TcleStatus,
} from '../types'

/**
 * Chamadas de pesquisa do TCC — dado de sujeito de pesquisa (TCLE/grupo/sessão/
 * SUS/RTLX), anonimizado, mora no backend Node/Supabase desde a Fase 13. Ver
 * docs/decisions/fase13-pesquisa-dados-no-node.md.
 */
export const pesquisaService = {
  // Aluno
  minhaParticipacao: (): Promise<MinhaParticipacao> => httpClient.get<MinhaParticipacao>('/pesquisa/minha-participacao'),

  consentirTcle: (aceito: boolean): Promise<TcleStatus> => httpClient.post<TcleStatus>('/pesquisa/tcle/consentir', { aceito }),

  iniciarSessao: (): Promise<Sessao> => httpClient.post<Sessao>('/pesquisa/sessoes/iniciar'),

  finalizarSessao: (sessaoId: string): Promise<Sessao> =>
    httpClient.post<Sessao>(`/pesquisa/sessoes/${sessaoId}/finalizar`),

  enviarSus: (sessaoId: string, itens: Record<string, number>, pontuacaoSus: number): Promise<void> =>
    httpClient.post(`/pesquisa/sessoes/${sessaoId}/sus`, { itens, pontuacaoSus }),

  enviarRtlx: (sessaoId: string, dimensoes: Record<string, number>, pontuacaoRtlx: number): Promise<void> =>
    httpClient.post(`/pesquisa/sessoes/${sessaoId}/rtlx`, { dimensoes, pontuacaoRtlx }),

  // Qualquer papel
  statusPesquisa: (turmaId: string): Promise<PesquisaStatus> => httpClient.get<PesquisaStatus>(`/pesquisa/status/${turmaId}`),

  // Pesquisador
  iniciarPesquisa: (turmaId: string, exercicioIds: string[]): Promise<Pesquisa> =>
    httpClient.post<Pesquisa>('/pesquisa/iniciar', { turmaId, exercicioIds }),

  historico: (turmaId: string): Promise<Pesquisa[]> => httpClient.get<Pesquisa[]>(`/pesquisa/turma/${turmaId}/historico`),

  sortearGrupos: (pesquisaId: string): Promise<SorteioResultado> =>
    httpClient.post<SorteioResultado>(`/pesquisa/${pesquisaId}/sortear-grupos`),

  encerrar: (pesquisaId: string): Promise<Pesquisa> => httpClient.post<Pesquisa>(`/pesquisa/${pesquisaId}/encerrar`),

  participantes: (pesquisaId: string): Promise<Participantes> =>
    httpClient.get<Participantes>(`/pesquisa/${pesquisaId}/participantes`),

  exportacao: (pesquisaId: string): Promise<Exportacao> => httpClient.get<Exportacao>(`/pesquisa/${pesquisaId}/exportacao`),
}
