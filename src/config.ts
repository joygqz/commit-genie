import { workspace } from 'vscode'

export interface Config {
  apiKey: string
  baseURL: string
  model: string
  language: string
  useEmoji: boolean
  instructions: string
}

// Local inference servers (Ollama, LM Studio, llama.cpp, …) expose an
// OpenAI-compatible API with no authentication, so an API key must not be a
// precondition for them. Anything else is treated as a hosted provider.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

export function requiresApiKey(baseURL: string): boolean {
  try {
    const { hostname } = new URL(baseURL)
    return !LOCAL_HOSTS.has(hostname) && !hostname.endsWith('.local')
  }
  catch {
    return true
  }
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
