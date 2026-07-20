import type { ExtensionContext, SourceControl } from 'vscode'
import type { Config } from './config'
import { commands, ConfigurationTarget, ProgressLocation, window, workspace } from 'vscode'
import { getConfig, requiresApiKey } from './config'
import { getDiff, getRepository } from './git'
import { listModels, streamCompletion } from './llm'
import { buildMessages } from './prompt'

let activeRequest: AbortController | undefined

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand('commit-genie.generate', generate),
    commands.registerCommand('commit-genie.selectModel', selectModel),
  )
}

export function deactivate() {
  activeRequest?.abort()
}

async function generate(sourceControl?: SourceControl) {
  const config = await requireConfig()
  if (!config) {
    return
  }

  activeRequest?.abort()
  const controller = new AbortController()
  activeRequest = controller

  try {
    const repo = getRepository(sourceControl)
    const diff = await getDiff(repo)
    if (!diff) {
      window.showInformationMessage('No changes to commit.')
      return
    }

    await window.withProgress(
      { location: ProgressLocation.SourceControl, title: 'Generating commit message…' },
      async () => {
        repo.inputBox.value = ''
        const message = await streamCompletion(
          config,
          buildMessages(diff, config),
          chunk => repo.inputBox.value += chunk,
          controller.signal,
        )
        repo.inputBox.value = cleanMessage(message)
      },
    )
  }
  catch (error) {
    if (!controller.signal.aborted) {
      showError(error)
    }
  }
  finally {
    if (activeRequest === controller) {
      activeRequest = undefined
    }
  }
}

async function selectModel() {
  // Listing models only needs the API key and base URL — the model itself
  // is what this command sets, so don't require it up front.
  const config = await requireConfig({ needModel: false })
  if (!config) {
    return
  }

  try {
    const models = await window.withProgress(
      { location: ProgressLocation.Notification, title: 'Loading models…' },
      () => listModels(config),
    )
    if (models.length === 0) {
      window.showWarningMessage('The provider returned no models.')
      return
    }

    const picked = await window.showQuickPick(
      models.map(id => ({ label: id, description: id === config.model ? 'Current' : undefined })),
      { title: 'Select Model', placeHolder: 'Pick the model used to generate commit messages' },
    )
    if (picked) {
      await workspace.getConfiguration('commit-genie').update('model', picked.label, ConfigurationTarget.Global)
    }
  }
  catch (error) {
    showError(error)
  }
}

async function requireConfig({ needModel = true } = {}): Promise<Config | undefined> {
  const config = getConfig()
  const missing = [
    !config.baseURL && 'a base URL',
    !config.apiKey && requiresApiKey(config.baseURL) && 'an API key',
    needModel && !config.model && 'a model',
  ].filter(item => typeof item === 'string')

  if (missing.length === 0) {
    return config
  }

  const open = 'Open Settings'
  const action = await window.showErrorMessage(
    `Commit Genie needs ${formatList(missing)}.`,
    open,
  )
  if (action === open) {
    commands.executeCommand('workbench.action.openSettings', '@ext:joygqz.commit-genie')
  }
  return undefined
}

/** "a base URL", "an API key" and "a model" → "a base URL, an API key and a model". */
function formatList(items: string[]): string {
  return items.length > 1
    ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
    : items[0]
}

/** Strip code fences or quotes some models wrap around the message. */
function cleanMessage(text: string): string {
  return text
    .trim()
    .replace(/^```\w*\n?/, '')
    .replace(/\n?```$/, '')
    .replace(/^"([\s\S]*)"$/, '$1')
    .trim()
}

function showError(error: unknown) {
  window.showErrorMessage(error instanceof Error ? error.message : String(error))
}
