import type { ExtensionContext } from 'vscode'
import { beforeEach, expect, it, vi } from 'vitest'
import { start } from '../src/controller'

const mocks = vi.hoisted(() => ({
  commands: new Map<string, (...args: unknown[]) => Promise<void>>(),
  getDiff: vi.fn(),
  streamCompletion: vi.fn(),
  repo: { inputBox: { value: 'existing' } },
}))

vi.mock('vscode', () => ({
  commands: { registerCommand: (id: string, callback: (...args: unknown[]) => Promise<void>) => {
    mocks.commands.set(id, callback)
    return { dispose() {} }
  } },
  window: {
    withProgress: (_options: unknown, callback: () => Promise<void>) => callback(),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
  ProgressLocation: { SourceControl: 1 },
  ConfigurationTarget: { Global: 1 },
}))
vi.mock('../src/config', () => ({ getConfig: () => ({ baseURL: 'http://local', model: 'local' }) }))
vi.mock('../src/git', () => ({ getRepository: () => mocks.repo, getDiff: mocks.getDiff }))
vi.mock('../src/llm', () => ({ listModels: vi.fn(), streamCompletion: mocks.streamCompletion }))

beforeEach(() => {
  mocks.getDiff.mockReset()
  mocks.streamCompletion.mockReset().mockResolvedValue('feat: current')
  mocks.repo.inputBox.value = 'existing'
})

it('superseded diff collection cannot clear or overwrite a newer generation', async () => {
  const context = { subscriptions: [] } as unknown as ExtensionContext
  start(context)
  let resolveOld!: (diff: string) => void
  mocks.getDiff.mockImplementationOnce(() => new Promise<string>((resolve) => {
    resolveOld = resolve
  }))
  const generate = mocks.commands.get('commit-genie.generate')!
  const older = generate()
  await Promise.resolve()
  mocks.getDiff.mockResolvedValueOnce('new diff')
  await generate()
  resolveOld('old diff')
  await older
  expect(mocks.streamCompletion).toHaveBeenCalledTimes(1)
  expect(mocks.repo.inputBox.value).toBe('feat: current')
})

it('disposal prevents an in-flight diff from starting an HTTP request', async () => {
  const context = { subscriptions: [] } as unknown as ExtensionContext
  const controller = start(context)
  let resolveDiff!: (diff: string) => void
  mocks.getDiff.mockImplementationOnce(() => new Promise<string>((resolve) => {
    resolveDiff = resolve
  }))
  const pending = mocks.commands.get('commit-genie.generate')!()
  await Promise.resolve()
  controller.dispose()
  resolveDiff('diff')
  await pending
  expect(mocks.streamCompletion).not.toHaveBeenCalled()
  expect(mocks.repo.inputBox.value).toBe('existing')
})
