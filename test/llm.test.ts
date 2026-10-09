import type { Config } from '../src/config'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { listModels, streamCompletion } from '../src/llm'

const config: Config = { baseURL: 'http://localhost/v1', apiKey: '', model: 'local', language: 'English', useEmoji: false, instructions: '' }
const frame = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}`

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('openAI-compatible transport', () => {
  it('preserves split UTF-8 and the final frame without a newline', async () => {
    const bytes = new TextEncoder().encode(`${frame('你好')}\n\n${frame(' world')}`)
    const stream = new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
        controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream)))
    const chunks: string[] = []
    expect(await streamCompletion(config, [], text => chunks.push(text), new AbortController().signal)).toBe('你好 world')
    expect(chunks).toEqual(['你好', ' world'])
  })

  it('rejects a pre-aborted request without calling fetch', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    controller.abort()
    await expect(listModels(config, controller.signal)).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps the timeout active while consuming the response body', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => Promise.resolve(new Response(new ReadableStream({
      start(controller) {
        init.signal!.addEventListener('abort', () => controller.error(init.signal!.reason))
      },
    })))))
    const pending = listModels(config)
    const assertion = expect(pending).rejects.toThrow('Request timed out after 120s.')
    await vi.advanceTimersByTimeAsync(120_000)
    await assertion
  })

  it('propagates consumer failures instead of treating them as malformed frames', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`${frame('text')}\n`)))
    await expect(streamCompletion(config, [], () => {
      throw new Error('consumer failed')
    }, new AbortController().signal)).rejects.toThrow('consumer failed')
  })

  it('omits empty authentication and sorts provider model IDs', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: [{ id: 'z' }, { id: 'a' }] }))
    vi.stubGlobal('fetch', fetch)
    expect(await listModels(config)).toEqual(['a', 'z'])
    expect(fetch.mock.calls[0][1].headers).toEqual({})
  })
})
