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

  return request(`${baseURL}/chat/completions`, signal, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader(apiKey) },
    body: JSON.stringify({ model, messages, stream: true }),
  }, async (response, requestSignal) => {
    if (!response.body)
      throw new Error('The API returned an empty response body.')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''
    const consume = (line: string) => {
      if (!line.startsWith('data:'))
        return
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]')
        return
      let delta: unknown
      try {
        delta = JSON.parse(data).choices?.[0]?.delta?.content
      }
      catch {
        return
      }
      if (typeof delta === 'string' && delta) {
        content += delta
        onChunk(delta)
      }
    }
    try {
      while (true) {
        const { done, value } = await reader.read()
        requestSignal.throwIfAborted()
        if (done)
          break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()!
        for (const line of lines) consume(line)
      }
      consume(buffer + decoder.decode())
      return content
    }
    finally {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    }
  })
}

export async function listModels(config: Config, signal?: AbortSignal): Promise<string[]> {
  const { apiKey, baseURL } = config

  return request(`${baseURL}/models`, signal, {
    headers: authHeader(apiKey),
  }, async (response) => {
    const body = await response.json() as { data?: { id: string }[] }
    return (body.data ?? []).map(model => model.id).sort()
  })
}

async function request<T>(
  url: string,
  signal: AbortSignal | undefined,
  init: RequestInit,
  consume: (response: Response, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted)
    abort()
  const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${REQUEST_TIMEOUT / 1000}s.`)), REQUEST_TIMEOUT)
  try {
    controller.signal.throwIfAborted()
    let response: Response
    try {
      response = await fetch(url, { ...init, signal: controller.signal })
    }
    catch (error) {
      if (error instanceof TypeError && !controller.signal.aborted) {
        throw new Error(`Cannot reach ${url}. Check your network and base URL.`)
      }
      throw error
    }
    if (!response.ok)
      throw new Error(await describeError(response))
    return await consume(response, controller.signal)
  }
  finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

/**
 * Reports the status alongside whatever the provider said, e.g.
 * "API request failed (404). The model `gpt-5` does not exist."
 * Providers name the actual problem far more precisely than any generic
 * per-status advice we could write here, so nothing is added on top.
 */
async function describeError(response: Response): Promise<string> {
  const summary = `API request failed (${response.status}).`
  const detail = await readDetail(response)
  return detail ? `${summary} ${detail}` : summary
}

/** The provider's message as one clipped, punctuated sentence; '' if unusable. */
async function readDetail(response: Response): Promise<string> {
  const body = (await response.text().catch(() => '')).trim()
  // Gateway HTML error pages carry no message worth showing.
  if (!body || body.startsWith('<')) {
    return ''
  }

  // Keep the raw body when it is not JSON, or carries no `error.message`.
  let message: unknown = body
  try {
    message = JSON.parse(body)?.error?.message
  }
  catch {
    // Not JSON — the body itself is the message.
  }

  const text = (typeof message === 'string' ? message : body).replace(/\s+/g, ' ').trim()
  if (!text) {
    return ''
  }
  if (text.length > 300) {
    return `${text.slice(0, 300)}…`
  }
  return /[.!?:;…。！？]$/.test(text) ? text : `${text}.`
}
