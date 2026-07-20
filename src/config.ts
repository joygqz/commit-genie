import { workspace } from 'vscode'

export interface Config {
  apiKey: string
  baseURL: string
  model: string
  language: string
  useEmoji: boolean
  instructions: string
}

export function getConfig(): Config {
  const config = workspace.getConfiguration('commit-genie')
  return {
    apiKey: config.get('apiKey', '').trim(),
    baseURL: config.get('baseURL', '').trim().replace(/\/+$/, ''),
    model: config.get('model', '').trim(),
    language: config.get('language', '').trim(),
    useEmoji: config.get('useEmoji', false),
    instructions: config.get('instructions', '').trim(),
  }
}
