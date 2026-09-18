import type { Page, Request } from '@playwright/test'

export const API = 'http://localhost:3000/api/v1'

export const ALUNO = { id: 'u1', nome: 'Maria Souza', email: 'maria@teste.com', papel: 'aluno' }

export function coluna(id: string, nome: string, mudancas: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    nome,
    tipo: 'INTEGER',
    tamanho: null,
    escala: null,
    pk: false,
    notNull: false,
    unique: false,
    autoIncremento: false,
    padrao: '',
    check: '',
    fk: null,
    ...mudancas,
  }
}

export function documentoLogico(tabelas: unknown[]): Record<string, unknown> {
  return { versao: 2, conceitual: null, conversao: null, logico: { tabelas, notas: [] } }
}

export function documentoConceitual(elementos: unknown[], ligacoes: unknown[]): Record<string, unknown> {
  return {
    versao: 2,
    logico: null,
    conversao: null,
    conceitual: { elementos, ligacoes, visaoAtributos: 'circulos' },
  }
}

export function entidade(id: string, nome: string, x: number, y: number): Record<string, unknown> {
  return { id, tipo: 'entidade', posicao: { x, y }, nome }
}

export function relacionamento(id: string, nome: string, x: number, y: number): Record<string, unknown> {
  return { id, tipo: 'relacionamento', posicao: { x, y }, nome, associativa: false }
}

export function atributo(
  id: string,
  nome: string,
  paiId: string,
  opcoes: { chave?: boolean; x?: number; y?: number } = {},
): Record<string, unknown> {
  return {
    id,
    tipo: 'atributo',
    posicao: { x: opcoes.x ?? 0, y: opcoes.y ?? 0 },
    nome,
    paiId,
    chave: opcoes.chave ?? false,
    cardinalidade: '(1,1)',
    tipoSugerido: null,
  }
}

export function participacao(
  id: string,
  relacionamentoId: string,
  entidadeId: string,
  min: 0 | 1,
  max: '1' | 'n',
): Record<string, unknown> {
  return { id, tipo: 'participacao', relacionamentoId, entidadeId, min, max, papel: '' }
}

export function exercicio(mudancas: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'e1',
    turmaId: 't1',
    provaId: null,
    titulo: 'Clientes e pedidos',
    enunciado: 'Um cliente faz vários pedidos. Liste o nome de cada cliente com a quantidade de pedidos.',
    nivelDificuldade: 'iniciante',
    ordem: 1,
    publico: false,
    gabaritoLiberado: false,
    temSql: true,
    temMer: true,
    temDissertativa: false,
    modoMer: 'logico',
    sqlSetup: null,
    criadoEm: '2026-09-01T00:00:00.000Z',
    ...mudancas,
  }
}

/** Painel do aluno sem turma nenhuma — o caso mais comum nos testes. */
export function painelAlunoVazio(mudancas: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    resumo: { turmas: 0, pendentes: 0, entregues: 0, acertos: 0 },
    disciplinas: [],
    pendencias: [],
    historico: [],
    progresso: { porTurma: [], tentativasAteAcertar: [] },
    ...mudancas,
  }
}

/** Painel do professor com uma turma — o estado padrão dos testes de navegação. */
export function painelProfessorPadrao(mudancas: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    resumo: { turmasAtivas: 1, turmasEncerradas: 0, alunos: 1, exercicios: 1, aguardandoRevisao: 0 },
    turmas: [
      {
        id: 't1',
        nome: 'Banco de Dados',
        disciplina: 'Banco de Dados',
        semestre: '2026.2',
  turno: null,
  sala: null,
        professorId: 'p1',
        codigo: 'ABC123',
        encerradaEm: null,
        criadoEm: '2026-09-01T00:00:00.000Z',
        alunos: 1,
        exercicios: 1,
        entregas: 0,
        aguardandoRevisao: 0,
        ultimaAtividadeEm: null,
      },
    ],
    ...mudancas,
  }
}

export interface ApiSimulada {
  // Corpos dos PUT /diagrama, na ordem em que chegaram.
  salvamentos: unknown[]
  // Corpos dos POST /pacote (imagens dos modelos + SQL do modelo).
  pacotes: PacoteRecebido[]
  // Quantas vezes POST /exercicios/e1/finalizar foi chamado.
  finalizacoes: number
}

export interface PacoteRecebido {
  imagens?: { rotulo: string; pngBase64: string }[]
  sqlModelo?: string
}

/**
 * Simula o backend Node (e derruba o de pesquisa, que não participa destes testes).
 * CORS com credenciais, porque o front chama outra origem.
 */
export async function simularApi(
  page: Page,
  opcoes: {
    exercicio?: Record<string, unknown>
    diagrama?: unknown
    // Quem está logado: aluno (padrão) ou o professor da turma, na tela de revisão.
    usuario?: Record<string, unknown>
    // Diagrama que o professor lê na revisão (GET /exercicios/e1/alunos/u1/diagrama).
    diagramaDoAluno?: unknown
    // Estudo livre e painel do aluno.
    exerciciosPublicos?: Record<string, unknown>[]
    turmas?: Record<string, unknown>[]
    // Resposta de POST /sandbox/livre/executar.
    resultadoLivre?: Record<string, unknown>
    // GET /painel/aluno e /painel/professor (Fase 9). O padrão não é `null`.
    painelAluno?: Record<string, unknown>
    painelProfessor?: Record<string, unknown>
    // Resposta do backend Python em /pesquisa/minha-participacao. Sem isto o serviço
    // responde 503 e o banner de pesquisa não aparece.
    participacao?: Record<string, unknown>
  } = {},
): Promise<ApiSimulada> {
  const estado: ApiSimulada = { salvamentos: [], pacotes: [], finalizacoes: 0 }
  const cabecalhos = {
    'access-control-allow-origin': 'http://localhost:5188',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE',
    'content-type': 'application/json',
  }
  const responder = (dados: unknown, status = 200): { status: number; headers: typeof cabecalhos; body: string } => ({
    status,
    headers: cabecalhos,
    body: JSON.stringify(status < 400 ? { data: dados } : { error: { code: 'ERRO', message: String(dados) } }),
  })
  const corpo = (requisicao: Request): unknown => requisicao.postDataJSON() as unknown

  await page.route(`${API}/**`, async (rota) => {
    const requisicao = rota.request()
    const url = requisicao.url()
    const metodo = requisicao.method()
    if (metodo === 'OPTIONS') return rota.fulfill({ status: 204, headers: cabecalhos })

    if (url.endsWith('/auth/me')) return rota.fulfill(responder(opcoes.usuario ?? ALUNO))
    if (url.endsWith('/exercicios/e1/alunos/u1/diagrama')) {
      const conteudo = opcoes.diagramaDoAluno
      const diagrama = conteudo === undefined ? null : { id: 'd1', exercicioId: 'e1', usuarioId: 'u1', conteudoJson: conteudo, versao: 1, atualizadoEm: '' }
      return rota.fulfill(responder(diagrama))
    }
    if (url.endsWith('/exercicios/e1/diagrama') && metodo === 'PUT') {
      const recebido = corpo(requisicao) as { conteudoJson: unknown }
      estado.salvamentos.push(recebido.conteudoJson)
      return rota.fulfill(responder({ id: 'd1', exercicioId: 'e1', usuarioId: 'u1', conteudoJson: recebido.conteudoJson, versao: 1, atualizadoEm: '' }))
    }
    if (url.endsWith('/exercicios/e1/diagrama')) {
      const diagrama = opcoes.diagrama === undefined ? null : { id: 'd1', exercicioId: 'e1', usuarioId: 'u1', conteudoJson: opcoes.diagrama, versao: 1, atualizadoEm: '' }
      return rota.fulfill(responder(diagrama))
    }
    if (url.endsWith('/exercicios/e1/pacote') && metodo === 'POST') {
      estado.pacotes.push(corpo(requisicao) as PacoteRecebido)
      return rota.fulfill({ status: 200, headers: { ...cabecalhos, 'content-type': 'application/pdf' }, body: '%PDF-1.4' })
    }
    if (url.endsWith('/exercicios/e1/finalizar') && metodo === 'POST') {
      estado.finalizacoes += 1
      return rota.fulfill(responder(null))
    }
    if (url.endsWith('/sandbox/livre/executar') && metodo === 'POST') {
      return rota.fulfill(responder(opcoes.resultadoLivre ?? { status: 'sucesso', rows: [] }))
    }
    if (url.endsWith('/exercicios/publicos')) return rota.fulfill(responder(opcoes.exerciciosPublicos ?? []))
    if (url.endsWith('/turmas/minhas')) return rota.fulfill(responder(opcoes.turmas ?? []))
    if (url.endsWith('/painel/aluno')) return rota.fulfill(responder(opcoes.painelAluno ?? painelAlunoVazio()))
    if (url.endsWith('/painel/professor')) {
      return rota.fulfill(responder(opcoes.painelProfessor ?? painelProfessorPadrao()))
    }
    if (url.endsWith('/exercicios/e1')) return rota.fulfill(responder(opcoes.exercicio ?? exercicio()))
    if (url.includes('/pesquisa/token')) {
      return opcoes.participacao
        ? rota.fulfill(responder({ token: 'token-de-teste' }))
        : rota.fulfill(responder('indisponível', 503))
    }
    return rota.fulfill(responder(null))
  })
  await page.route('http://localhost:8001/**', (rota) => {
    if (rota.request().method() === 'OPTIONS') return rota.fulfill({ status: 204, headers: cabecalhos })
    if (opcoes.participacao && rota.request().url().includes('/pesquisa/minha-participacao')) {
      return rota.fulfill({ status: 200, headers: cabecalhos, body: JSON.stringify(opcoes.participacao) })
    }
    return rota.fulfill({ status: 503, headers: cabecalhos, body: '{}' })
  })
  return estado
}
