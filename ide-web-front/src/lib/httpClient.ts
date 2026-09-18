const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'

interface ApiEnvelope<TData> {
  data?: TData
  error?: { code: string; message: string }
}

export class HttpError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

async function parseBody<TData>(response: Response): Promise<ApiEnvelope<TData> | undefined> {
  if (response.status === 204) return undefined

  try {
    return (await response.json()) as ApiEnvelope<TData>
  } catch {
    return undefined
  }
}

/**
 * O backend emite refresh desde a Fase 1, mas ninguém o chamava: a sessão caía em 15
 * minutos porque nada renovava (Fase 10, D2). Uma renovação por vez — se várias
 * requisições tomarem 401 juntas, todas esperam a mesma promessa.
 */
const ROTAS_SEM_RENOVACAO = ['/auth/login', '/auth/registrar', '/auth/refresh', '/auth/logout']
let renovacaoEmCurso: Promise<boolean> | null = null

async function renovarSessao(): Promise<boolean> {
  renovacaoEmCurso ??= fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((resposta) => resposta.ok)
    .catch(() => false)
    .finally(() => {
      renovacaoEmCurso = null
    })

  return renovacaoEmCurso
}

async function enviar(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')

  return fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: 'include' })
}

async function request<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  let response = await enviar(path, init)

  // 401 no fluxo de autenticação é resposta legítima (senha errada, logout já feito):
  // renovar ali daria um laço.
  if (response.status === 401 && !ROTAS_SEM_RENOVACAO.includes(path) && (await renovarSessao())) {
    response = await enviar(path, init)
  }

  const body = await parseBody<TResponse>(response)

  if (!response.ok) {
    throw new HttpError(
      response.status,
      body?.error?.code ?? 'UNKNOWN_ERROR',
      body?.error?.message ?? `Request failed: ${String(response.status)} ${response.statusText}`,
    )
  }

  return body?.data as TResponse
}

export const httpClient = {
  get: <TResponse>(path: string): Promise<TResponse> => request<TResponse>(path, { method: 'GET' }),

  post: <TResponse>(path: string, body?: unknown): Promise<TResponse> =>
    request<TResponse>(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),

  put: <TResponse>(path: string, body: unknown): Promise<TResponse> =>
    request<TResponse>(path, { method: 'PUT', body: JSON.stringify(body) }),

  patch: <TResponse>(path: string, body: unknown): Promise<TResponse> =>
    request<TResponse>(path, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: <TResponse>(path: string): Promise<TResponse> => request<TResponse>(path, { method: 'DELETE' }),
}
