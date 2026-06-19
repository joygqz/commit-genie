import type { SourceControl, Uri } from 'vscode'
import { extensions } from 'vscode'

export interface Repository {
  readonly rootUri: Uri
  readonly inputBox: { value: string }
  diff: (cached?: boolean) => Promise<string>
}

interface GitExtension {
  getAPI: (version: 1) => { repositories: Repository[] }
}

const LOCK_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'composer.lock',
  'Cargo.lock',
  'Gemfile.lock',
  'poetry.lock',
  'uv.lock',
  'go.sum',
])

// Keep prompts within a sane token budget even for huge diffs.
const MAX_DIFF_LENGTH = 80_000

export function getRepository(sourceControl?: SourceControl): Repository {
  const git = extensions.getExtension<GitExtension>('vscode.git')?.exports.getAPI(1)
  if (!git || git.repositories.length === 0) {
    throw new Error('No Git repository found in the current workspace.')
  }

  const root = sourceControl?.rootUri?.fsPath
  return git.repositories.find(repo => repo.rootUri.fsPath === root) ?? git.repositories[0]
}

/**
 * Staged diff, falling back to working-tree changes when nothing is staged.
 * Lock files and binary files are collapsed into a one-line change summary so
 * the model still knows they changed without spending tokens on their content.
 */
export async function getDiff(repo: Repository): Promise<string> {
  const diff = (await repo.diff(true)) || (await repo.diff(false))
  const filtered = diff
    .split(/^(?=diff --git )/m)
    .map(summarizeSection)
    .filter(Boolean)
    .join('')
    .trim()

  return filtered.length > MAX_DIFF_LENGTH
    ? `${filtered.slice(0, MAX_DIFF_LENGTH)}\n\n[diff truncated]`
    : filtered
}

/**
 * Returns the section unchanged, or a compact summary line for lock and binary
 * files, whose raw diff carries no useful content. The summary keeps the file
 * in the change list so the model still knows it changed.
 */
function summarizeSection(section: string): string {
  if (!section) {
    return section
  }

  const path = section
    .slice(0, section.indexOf('\n'))
    .match(/ b\/(.+?)"?$/)?.[1] ?? ''

  const change = changeType(section)

  if (LOCK_FILES.has(path.split('/').pop() ?? '')) {
    return `Lock file ${change}: ${path}\n`
  }

  if (/^Binary files .* differ$/m.test(section)) {
    return `Binary file ${change}: ${path}\n`
  }

  return section
}

function changeType(section: string): string {
  if (/^new file mode/m.test(section)) {
    return 'added'
  }
  if (/^deleted file mode/m.test(section)) {
    return 'deleted'
  }
  return 'modified'
}
