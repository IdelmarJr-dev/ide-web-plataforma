import { HttpError } from './httpClient'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'

/**
 * Fetch cru pra respostas binárias (ex.: PDF) — `httpClient` sempre assume o
 * envelope JSON `{ data, error }`, o que não serve pra um `Content-Type:
 * application/pdf`.
 */
export async function postForBlob(path: string, body: unknown): Promise<Blob> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const envelope = (await response.json().catch(() => undefined)) as
      | { error?: { code: string; message: string } }
      | undefined
    throw new HttpError(
      response.status,
      envelope?.error?.code ?? 'UNKNOWN_ERROR',
      envelope?.error?.message ?? `Request failed: ${String(response.status)} ${response.statusText}`,
    )
  }

  return response.blob()
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
