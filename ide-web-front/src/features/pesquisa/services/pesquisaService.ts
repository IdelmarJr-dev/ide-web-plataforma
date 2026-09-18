import { researchHttpClient } from './researchHttpClient'
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

/** Chamadas ao backend Python de pesquisa (self-hosted) — ver docs/decisions/fase6-alinhamento-tcc.md. */
export const pesquisaService = {
  // Aluno
  minhaParticipacao: (): Promise<MinhaParticipacao> =>
    researchHttpClient.get<MinhaParticipacao>('/pesquisa/minha-participacao'),

  consentirTcle: (aceito: boolean): Promise<TcleStatus> =>
    researchHttpClient.post<TcleStatus>('/tcle/consentir', { aceito }),

  iniciarSessao: (): Promise<Sessao> => researchHttpClient.post<Sessao>('/sessoes/iniciar'),

  finalizarSessao: (sessaoId: string): Promise<Sessao> =>
    researchHttpClient.post<Sessao>(`/sessoes/${sessaoId}/finalizar`),

  enviarSus: (sessaoId: string, itens: Record<string, number>, pontuacaoSus: number): Promise<void> =>
    researchHttpClient.post(`/sessoes/${sessaoId}/sus`, { itens, pontuacaoSus }),

  enviarRtlx: (sessaoId: string, dimensoes: Record<string, number>, pontuacaoRtlx: number): Promise<void> =>
    researchHttpClient.post(`/sessoes/${sessaoId}/rtlx`, { dimensoes, pontuacaoRtlx }),

  // Qualquer papel
  statusPesquisa: (turmaId: string): Promise<PesquisaStatus> =>
    researchHttpClient.get<PesquisaStatus>(`/pesquisa/status/${turmaId}`),

  // Pesquisador
  iniciarPesquisa: (turmaId: string, exercicioIds: string[]): Promise<Pesquisa> =>
    researchHttpClient.post<Pesquisa>('/pesquisa/iniciar', { turmaId, exercicioIds }),

  historico: (turmaId: string): Promise<Pesquisa[]> =>
    researchHttpClient.get<Pesquisa[]>(`/pesquisa/turma/${turmaId}/historico`),

  sortearGrupos: (pesquisaId: string): Promise<SorteioResultado> =>
    researchHttpClient.post<SorteioResultado>(`/pesquisa/${pesquisaId}/sortear-grupos`),

  encerrar: (pesquisaId: string): Promise<Pesquisa> => researchHttpClient.post<Pesquisa>(`/pesquisa/${pesquisaId}/encerrar`),

  participantes: (pesquisaId: string): Promise<Participantes> =>
    researchHttpClient.get<Participantes>(`/pesquisa/${pesquisaId}/participantes`),

  exportacao: (pesquisaId: string): Promise<Exportacao> =>
    researchHttpClient.get<Exportacao>(`/pesquisa/${pesquisaId}/exportacao`),
}
