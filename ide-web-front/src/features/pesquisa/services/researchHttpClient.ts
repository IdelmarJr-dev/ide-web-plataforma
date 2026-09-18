import { httpClient } from '../../../lib/httpClient'

const RESEARCH_BASE_URL = import.meta.env.VITE_RESEARCH_API_URL ?? 'http://localhost:8001'
const TOKEN_REFRESH_MARGIN_MS = 60_000

export class ResearchHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ResearchHttpError'
    this.status = status
  }
}

interface CachedToken {
  value: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null

function decodeJwtExpiryMs(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    return typeof decoded.exp === 'number' ? decoded.exp * 1000 : null
  } catch {
    return null
  }
}

async function getToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt - TOKEN_REFRESH_MARGIN_MS > now) {
    return cachedToken.value
  }

  const { token } = await httpClient.get<{ token: string }>('/pesquisa/token')
  const expiresAt = decodeJwtExpiryMs(token) ?? now + TOKEN_REFRESH_MARGIN_MS
  cachedToken = { value: token, expiresAt }
  return token
}

interface FastApiErrorBody {
  detail?: string | { msg?: string }[]
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as FastApiErrorBody
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      const first = body.detail[0]?.msg
      if (first) return first
    }
  } catch {
    // corpo não é JSON — segue com a mensagem genérica abaixo
  }
  return `Request failed: ${String(response.status)} ${response.statusText}`
}

async function request<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const token = await getToken()
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${RESEARCH_BASE_URL}${path}`, { ...init, headers })

  if (!response.ok) {
    if (response.status === 401) cachedToken = null
    throw new ResearchHttpError(response.status, await parseErrorMessage(response))
  }

  if (response.status === 204) return undefined as TResponse
  return (await response.json()) as TResponse
}

export const researchHttpClient = {
  get: <TResponse>(path: string): Promise<TResponse> => request<TResponse>(path, { method: 'GET' }),

  post: <TResponse>(path: string, body?: unknown): Promise<TResponse> =>
    request<TResponse>(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
}
