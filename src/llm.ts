import type { Config } from './config'

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

const REQUEST_TIMEOUT = 120_000

/**
 * Omits the header entirely when no key is set — local servers need no auth,
 * and some reject a malformed `Bearer ` with an empty token.
 */
function authHeader(apiKey: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
}

/**
 * Streams a chat completion from any OpenAI-compatible endpoint.
 * Returns the full response text once the stream ends.
 */
export async function streamCompletion(
  config: Config,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const { apiKey, baseURL, model } = config

  const response = await request(`${baseURL}/chat/completions`, signal, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(apiKey),
    },
    body: JSON.stringify({ model, messages, stream: true }),
  })

  if (!response.body) {
    throw new Error('The API returned an empty response body.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''

  while (true) {
    const { done, value } = await reader.read()
    signal.throwIfAborted()
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

export async function listModels(config: Config, signal?: AbortSignal): Promise<string[]> {
  const { apiKey, baseURL } = config

  const response = await request(`${baseURL}/models`, signal, {
    headers: authHeader(apiKey),
  })

  const body = await response.json() as { data?: { id: string }[] }
  return (body.data ?? []).map(model => model.id).sort()
}

async function request(url: string, signal: AbortSignal | undefined, init: RequestInit): Promise<Response> {
  // Stay linked to the caller's signal for the lifetime of the response, so
  // aborting also cancels body streaming — not just the initial fetch.
  const controller = new AbortController()
  signal?.addEventListener('abort', () => controller.abort(), { once: true })
  const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${REQUEST_TIMEOUT / 1000}s.`)), REQUEST_TIMEOUT)

  let response: Response
  try {
    response = await fetch(url, { ...init, signal: controller.signal })
  }
  catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Cannot reach ${url}. Check your network and base URL.`)
    }
    throw error
  }
  finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new Error(await describeError(response))
  }
  return response
}

async function describeError(response: Response): Promise<string> {
  let detail = ''
  try {
    const body = (await response.text()).trim()
    try {
      detail = JSON.parse(body)?.error?.message ?? body
    }
    catch {
      // Non-JSON bodies are usually gateway HTML error pages — showing their
      // markup in a notification helps nobody, so drop them.
      detail = body.startsWith('<') ? '' : body
    }
  }
  catch {
    // unreadable body
  }

  const hints: Record<number, string> = {
    401: 'Check that your API key is set and valid.',
    403: 'Your API key does not have access to this endpoint or model.',
    404: 'Check your base URL and model.',
    429: 'Rate limited — try again in a moment.',
  }

  const parts = [`API request failed (${response.status}).`]
  if (detail) {
    parts.push(detail.replace(/\s+/g, ' ').slice(0, 300))
  }
  if (hints[response.status]) {
    parts.push(hints[response.status])
  }
  return parts.join(' ')
}
