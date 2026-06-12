import { getConfig } from './config'

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

const REQUEST_TIMEOUT = 120_000

/**
 * Streams a chat completion from any OpenAI-compatible endpoint.
 * Returns the full response text once the stream ends.
 */
export async function streamCompletion(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const { apiKey, baseURL, model } = getConfig()

  const response = await request(`${baseURL}/chat/completions`, signal, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
  })

  if (!response.body) {
    throw new Error('API returned an empty response body.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()!

    for (const line of lines) {
      if (!line.startsWith('data:')) {
        continue
      }
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') {
        continue
      }
      try {
        const delta: string | undefined = JSON.parse(data).choices?.[0]?.delta?.content
        if (delta) {
          content += delta
          onChunk(delta)
        }
      }
      catch {
        // ignore malformed keep-alive / partial frames
      }
    }
  }

  return content
}

export async function listModels(signal?: AbortSignal): Promise<string[]> {
  const { apiKey, baseURL } = getConfig()

  const response = await request(`${baseURL}/models`, signal, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  const body = await response.json() as { data?: { id: string }[] }
  return (body.data ?? []).map(model => model.id).sort()
}

async function request(url: string, signal: AbortSignal | undefined, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  const timer = setTimeout(() => controller.abort(new Error('Request timed out.')), REQUEST_TIMEOUT)
  signal?.addEventListener('abort', abort, { once: true })

  let response: Response
  try {
    response = await fetch(url, { ...init, signal: controller.signal })
  }
  catch (error) {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
    if (error instanceof TypeError) {
      throw new Error(`Cannot reach ${url}. Check your network and base URL.`)
    }
    throw error
  }

  clearTimeout(timer)
  signal?.removeEventListener('abort', abort)

  if (!response.ok) {
    throw new Error(await describeError(response))
  }
  return response
}

async function describeError(response: Response): Promise<string> {
  let detail = ''
  try {
    const body = await response.text()
    try {
      detail = JSON.parse(body)?.error?.message ?? body
    }
    catch {
      detail = body
    }
  }
  catch {
    // unreadable body
  }

  const hints: Record<number, string> = {
    401: 'Check your API key.',
    404: 'Check your base URL and model.',
    429: 'Rate limited — try again later.',
  }

  const parts = [`API request failed (${response.status}).`]
  if (detail) {
    parts.push(detail.slice(0, 300))
  }
  if (hints[response.status]) {
    parts.push(hints[response.status])
  }
  return parts.join(' ')
}
