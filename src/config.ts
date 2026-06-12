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
    baseURL: config.get('baseURL', 'https://api.deepseek.com').trim().replace(/\/+$/, ''),
    model: config.get('model', 'deepseek-chat').trim(),
    language: config.get('language', 'English').trim() || 'English',
    useEmoji: config.get('useEmoji', false),
    instructions: config.get('instructions', '').trim(),
  }
}
