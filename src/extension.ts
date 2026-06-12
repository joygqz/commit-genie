import type { ExtensionContext, SourceControl } from 'vscode'
import type { Config } from './config'
import { commands, ConfigurationTarget, ProgressLocation, window, workspace } from 'vscode'
import { getConfig } from './config'
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
      { location: ProgressLocation.Notification, title: 'Generating commit message…', cancellable: true },
      async (_progress, token) => {
        token.onCancellationRequested(() => controller.abort())

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
  const config = await requireConfig()
  if (!config) {
    return
  }

  try {
    const models = await window.withProgress(
      { location: ProgressLocation.Notification, title: 'Loading models…' },
      () => listModels(config),
    )
    if (models.length === 0) {
      window.showWarningMessage('The API returned no models.')
      return
    }

    const picked = await window.showQuickPick(
      models.map(id => ({ label: id, description: id === config.model ? 'current' : undefined })),
      { placeHolder: 'Select a model' },
    )
    if (picked) {
      await workspace.getConfiguration('commit-genie').update('model', picked.label, ConfigurationTarget.Global)
    }
  }
  catch (error) {
    showError(error)
  }
}

async function requireConfig(): Promise<Config | undefined> {
  const config = getConfig()
  if (config.apiKey && config.baseURL && config.model) {
    return config
  }

  const open = 'Open Settings'
  const action = await window.showErrorMessage('Commit Genie needs an API key, base URL and model.', open)
  if (action === open) {
    commands.executeCommand('workbench.action.openSettings', '@ext:joygqz.commit-genie')
  }
  return undefined
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
