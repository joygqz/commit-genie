import type { ExtensionContext } from 'vscode'
import { start } from './controller'

let controller: ReturnType<typeof start> | undefined

export function activate(context: ExtensionContext) {
  controller = start(context)
}

export function deactivate() {
  const current = controller
  controller = undefined
  current?.dispose()
}
