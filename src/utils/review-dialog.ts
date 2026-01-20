import type { CodeReviewResult, ReviewItem } from '../prompts'
import { l10n, Uri, window, workspace } from 'vscode'
import { logger } from './logger'

/**
 * 将 ReviewItem 转换为字符串（用于向后兼容）
 */
function reviewItemToString(item: string | ReviewItem): string {
  if (typeof item === 'string') {
    return item
  }
  let result = item.description
  if (item.file && item.line) {
    result += ` (${item.file}:${item.line})`
  }
  else if (item.file) {
    result += ` (${item.file})`
  }
  return result
}

/**
 * 打开文件并跳转到指定行
 */
async function openFileAtLine(file: string, line?: number): Promise<void> {
  try {
    const workspaceRoot = workspace.workspaceFolders?.[0]?.uri
    if (!workspaceRoot) {
      window.showErrorMessage(l10n.t('No workspace folder found'))
      return
    }

    const fileUri = Uri.joinPath(workspaceRoot, file)
    const document = await workspace.openTextDocument(fileUri)
    const editor = await window.showTextDocument(document)

    if (line !== undefined && line > 0) {
      const position = editor.document.lineAt(Math.min(line - 1, editor.document.lineCount - 1)).range.start
      editor.selection = new (await import('vscode')).Selection(position, position)
      editor.revealRange(editor.selection, 1) // 1 = vscode.TextEditorRevealType.InCenter
    }
  }
  catch (error) {
    logger.error('Failed to open file', error)
    window.showErrorMessage(l10n.t('Failed to open file: {0}', file))
  }
}

/**
 * 显示代码 review 结果并询问用户是否继续
 * @param review Code review 结果
 * @returns 用户是否选择继续
 */
export async function showReviewResultAndAskToContinue(review: CodeReviewResult): Promise<boolean> {
  if (review.passed) {
    logger.info('Code review passed')
    return true
  }

  // 检查是否有带文件信息的项
  const hasFileInfo = review.issues.some(
    item => typeof item === 'object' && item.file,
  )

  // 如果有文件信息，使用快速选择界面
  if (hasFileInfo) {
    return await showReviewWithQuickPick(review)
  }

  // 否则使用传统的警告对话框
  return await showReviewWithWarningMessage(review)
}

/**
 * 使用快速选择界面显示 review 结果
 */
async function showReviewWithQuickPick(review: CodeReviewResult): Promise<boolean> {
  interface ReviewQuickPickItem {
    label: string
    description?: string
    detail?: string
    kind?: number
    action?: () => Promise<void>
  }

  const items: ReviewQuickPickItem[] = []

  // 添加问题
  review.issues.forEach((issue, index) => {
    if (typeof issue === 'string') {
      items.push({
        label: `${index + 1}. ${issue}`,
      })
    }
    else {
      const fileInfo = issue.line ? `${issue.file}:${issue.line}` : issue.file || ''
      // 如果描述太长，label 显示简短版本，detail 显示完整描述
      const shortDesc = issue.description.length > 60
        ? `${issue.description.substring(0, 60)}...`
        : issue.description

      items.push({
        label: `${index + 1}. ${shortDesc}`,
        description: undefined, // 隐藏路径，不在 label 右侧显示
        detail: issue.description.length > 60
          ? `${issue.description}\n\n${fileInfo}`
          : fileInfo,
        action: issue.file ? async () => await openFileAtLine(issue.file!, issue.line) : undefined,
      })
    }
  })

  // 添加分隔符和操作按钮
  items.push({
    label: '',
    kind: -1,
  })
  items.push({
    label: `$(check) ${l10n.t('Continue anyway')}`,
    description: l10n.t('Proceed with commit despite issues'),
  })
  items.push({
    label: `$(close) ${l10n.t('Cancel')}`,
    description: l10n.t('Do not commit'),
  })

  const quickPick = window.createQuickPick()
  quickPick.title = l10n.t('Code Review Results')
  quickPick.items = items
  quickPick.placeholder = l10n.t('Select an issue to view, or choose an action')
  quickPick.canSelectMany = false
  quickPick.ignoreFocusOut = true // 防止失去焦点时关闭

  return new Promise((resolve) => {
    let isResolving = false

    // 使用 onDidChangeSelection 来处理文件打开（不会关闭面板）
    quickPick.onDidChangeSelection((selected) => {
      const item = selected[0] as ReviewQuickPickItem | undefined
      if (!item) {
        return
      }

      // 如果有 action（即文件链接），则打开文件但保持面板打开
      if (item.action) {
        item.action().catch(error => logger.error('Failed to execute action', error))
        // 不关闭面板，用户可以继续查看其他问题
      }
    })

    // 使用 onDidAccept 来处理确认操作（继续或取消按钮）
    quickPick.onDidAccept(() => {
      const selected = quickPick.selectedItems[0] as ReviewQuickPickItem | undefined
      if (!selected) {
        return
      }

      // 处理操作按钮
      if (selected.label.includes(l10n.t('Continue anyway'))) {
        isResolving = true
        quickPick.hide()
        resolve(true)
        return
      }

      if (selected.label.includes(l10n.t('Cancel'))) {
        isResolving = true
        quickPick.hide()
        resolve(false)
      }

      // 对于其他项（文件链接），不做任何处理，因为已在 onDidChangeSelection 中处理
    })

    quickPick.onDidHide(() => {
      quickPick.dispose()
      // 只有在未通过按钮明确选择时，才默认为取消
      if (!isResolving) {
        resolve(false)
      }
    })

    quickPick.show()
  })
}

/**
 * 使用传统警告对话框显示 review 结果
 */
async function showReviewWithWarningMessage(review: CodeReviewResult): Promise<boolean> {
  // 构建消息内容
  const issuesText = review.issues.length > 0
    ? `${review.issues.map((issue, index) => `${index + 1}. ${reviewItemToString(issue)}`).join('\n')}`
    : ''

  // 生成标题
  const title = `⚠️ ${l10n.t('Code review found issues')}`

  const message = `${title}\n\n${issuesText}`
  const continueButton = l10n.t('Continue anyway')

  const choice = await window.showWarningMessage(
    message,
    { modal: true },
    continueButton,
  )

  return choice === continueButton
}
