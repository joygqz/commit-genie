import type { ExtensionContext } from 'vscode'
import type { DailyReportResult } from './prompts'
import { ConfigurationTarget, env, l10n, QuickPickItemKind, window } from 'vscode'
import { generateDailyReportPrompt, generateReviewAndCommitPrompt } from './prompts'
import { AbortManager } from './utils/abort-manager'
import { config } from './utils/config'
import { EXTENSION_NAME } from './utils/constants'
import { getUserFriendlyErrorMessage, shouldSilenceError } from './utils/error-handler'
import { getDiffStaged, getRepo, getTodayCommits } from './utils/git'
import { logger, ProgressHandler, validateConfig } from './utils/index'
import { ChatGPTAPI, getAvailableModels } from './utils/openai'
import { showReviewResultAndAskToContinue } from './utils/review-dialog'
import { tokenTracker } from './utils/token-tracker'

/**
 * AbortController 管理器实例
 */
const abortManager = new AbortManager()

/**
 * 审查代码并生成 commit 消息命令
 * @param context 扩展上下文
 */
async function reviewAndCommit(context: ExtensionContext) {
  const controller = abortManager.createController()

  // 开始一个新的 token 统计会话
  tokenTracker.startSession()

  try {
    logger.info('Starting review and commit workflow')

    // 验证配置
    const validation = validateConfig([
      { key: 'service.apiKey', required: true, errorMessage: l10n.t('API Key is required. Please configure it in settings.') },
      { key: 'service.baseURL', required: true, errorMessage: l10n.t('Base URL is required. Please configure it in settings.') },
      { key: 'service.model', required: true, errorMessage: l10n.t('Model is required. Please configure it in settings.') },
    ])
    if (!validation.isValid) {
      logger.warn('Configuration validation failed', { error: validation.error })
      window.showErrorMessage(validation.error!)
      return
    }

    // 获取暂存区的 diff
    const repo = await getRepo(context)
    const diff = await getDiffStaged(repo)
    if (!diff || diff === l10n.t('No staged changes.')) {
      logger.info('No staged changes found')
      window.showInformationMessage(l10n.t('No staged changes to commit.'))
      return
    }

    logger.debug('Retrieved staged changes', { diffLength: diff.length })

    // 获取 SCM 输入框
    const scmInputBox = repo.inputBox
    if (!scmInputBox) {
      throw new Error(l10n.t('Unable to find SCM input box.'))
    }

    // 执行代码审查并生成提交信息
    const { review: reviewResult, commitMessage } = await ProgressHandler.withProgress(
      '',
      async (progress, token) => {
        progress.report({ message: l10n.t('Reviewing changes and generating commit message...') })

        token?.onCancellationRequested(() => {
          controller.abort()
        })

        // 生成 prompt 并调用 API
        logger.info('Starting combined review and commit generation')

        const prompts = await generateReviewAndCommitPrompt(diff)

        const apiResult = await ChatGPTAPI(prompts, { signal: controller.signal })

        logger.debug('Combined review+commit response received', {
          content: apiResult.content,
          hasUsage: !!apiResult.usage,
        })

        // 记录 token 使用信息
        if (apiResult.usage) {
          const usage = apiResult.usage
          const parts: string[] = []

          // 基础 token 信息
          parts.push(`Token Usage: ${usage.totalTokens} total`)
          parts.push(`(${usage.promptTokens} prompt + ${usage.completionTokens} completion)`)

          // 缓存信息
          if (usage.cachedTokens && usage.cachedTokens > 0) {
            const cacheHitRate = ((usage.cachedTokens / usage.promptTokens) * 100).toFixed(1)
            const cacheMissTokens = usage.promptTokens - usage.cachedTokens
            parts.push(`| Cache Hit: ${usage.cachedTokens} tokens (${cacheHitRate}%)`)
            parts.push(`Miss: ${cacheMissTokens} tokens`)
          }

          logger.info(parts.join(' '))

          // 更新状态栏显示
          tokenTracker.updateUsage(usage)
        }

        // 解析 API 响应（JSON mode 保证返回合法 JSON）
        try {
          const parsed = JSON.parse(apiResult.content.trim())
          const defaultReview = {
            passed: true,
            issues: [] as string[],
            suggestions: [] as string[],
          }
          const review = parsed.review ?? defaultReview
          const commitMessage = (parsed.commitMessage ?? '').trim()

          if (!commitMessage) {
            logger.warn('Response missing commitMessage')
          }

          return {
            review,
            commitMessage,
          }
        }
        catch (error) {
          logger.error('Failed to parse JSON response', error)
          throw new Error(l10n.t('Invalid response format from API. Please try again.'))
        }
      },
      true,
    )

    // 如果 review 不通过，询问用户是否继续
    if (!reviewResult.passed) {
      const shouldContinue = await showReviewResultAndAskToContinue(reviewResult)
      if (!shouldContinue) {
        logger.info('User cancelled commit after review')
        return
      }
    }

    // 应用提交信息到 SCM 输入框
    const normalizedCommitMessage = commitMessage.trim()
    if (normalizedCommitMessage.length > 0) {
      scmInputBox.value = normalizedCommitMessage
      logger.info('Commit message applied successfully', { messageLength: normalizedCommitMessage.length })
    }
    else {
      logger.warn('No commit message generated')
      window.showWarningMessage(l10n.t('Failed to generate commit message.'))
    }
  }
  catch (error: unknown) {
    if (shouldSilenceError(error)) {
      return
    }

    logger.error('Failed to complete review and commit workflow', error)
    window.showErrorMessage(getUserFriendlyErrorMessage(error))
  }
  finally {
    // 结束 token 统计会话
    tokenTracker.endSession()
    abortManager.clear(controller)
  }
}

/**
 * 选择可用模型命令
 */
async function selectAvailableModel() {
  try {
    logger.info('Fetching available models')

    // 验证 API 配置
    const validation = validateConfig([
      {
        key: 'service.apiKey',
        required: true,
        errorMessage: l10n.t('API Key is required. Please configure it in settings.'),
      },
      {
        key: 'service.baseURL',
        required: true,
        errorMessage: l10n.t('Base URL is required. Please configure it in settings.'),
      },
    ])
    if (!validation.isValid) {
      window.showErrorMessage(validation.error!)
      return
    }

    // 从 API 获取可用模型列表
    const models = await getAvailableModels()

    logger.debug('Retrieved models', { count: models.length, models })

    if (!models.length) {
      logger.warn('No models available')
      window.showWarningMessage(l10n.t('No models available from current API configuration.'))
      return
    }

    // 获取当前配置的模型
    const currentModel = config.get<string>('service.model')

    // 构建快速选择列表项
    const items = models.map(model => ({
      label: model,
      description: model === currentModel ? l10n.t('Current') : undefined,
    }))

    // 显示模型选择列表
    const picked = await window.showQuickPick(items, {
      title: l10n.t('Select Model'),
      placeHolder: l10n.t('Please select a model to generate commit messages.'),
      matchOnDescription: true,
    })

    if (!picked) {
      return
    }

    // 更新模型配置
    await config.update('service.model', picked.label, ConfigurationTarget.Global)
    logger.info('Model updated', { model: picked.label })
    window.showInformationMessage(l10n.t('Model updated to {0}.', picked.label))
  }
  catch (error: unknown) {
    logger.error('Failed to select model', error)
    const message = getUserFriendlyErrorMessage(error)
    window.showErrorMessage(message)
  }
}

/**
 * 显示 Token 使用统计命令
 */
async function showTokenStats() {
  try {
    logger.debug('Showing token usage statistics')

    const currentStats = tokenTracker.getCurrentStats()
    const historicalStats = tokenTracker.getHistoricalStats()

    // 如果没有任何数据，显示提示信息
    if (!historicalStats) {
      window.showInformationMessage(l10n.t('No usage records'))
      return
    }

    // 构建统计项列表
    const items: Array<{ label: string, detail?: string, kind?: QuickPickItemKind }> = []

    // 如果有当前会话的统计数据,添加当前会话部分
    if (currentStats) {
      items.push(
        { label: `${l10n.t('Current Operation')}`, kind: QuickPickItemKind.Separator },
        { label: l10n.t('Total Tokens: {0}', currentStats.totalTokens) },
        { label: l10n.t('Prompt Tokens: {0}', currentStats.promptTokens) },
        { label: l10n.t('Completion Tokens: {0}', currentStats.completionTokens) },
      )

      // 只有缓存 token 大于 0 时才显示缓存行
      if (currentStats.cachedTokens > 0) {
        items.push({ label: l10n.t('Cache Hit Rate: {0}%', currentStats.cacheHitRate) })
      }
    }

    // 添加累计统计部分
    items.push(
      { label: `${l10n.t('Cumulative Statistics')}`, kind: QuickPickItemKind.Separator },
      { label: l10n.t('Total Operations: {0}', historicalStats.operationCount) },
      { label: l10n.t('Total Tokens: {0}', historicalStats.totalTokens) },
      { label: l10n.t('Average Tokens per Operation: {0}', historicalStats.avgTokens) },
      { label: l10n.t('Overall Cache Hit Rate: {0}%', historicalStats.overallCacheRate) },
    )

    // 显示统计信息
    await window.showQuickPick(items, {
      title: `${EXTENSION_NAME} ${l10n.t('Usage Statistics')}`,
      placeHolder: l10n.t('Press ESC to close'),
    })
  }
  catch (error: unknown) {
    logger.error('Failed to show token stats', error)
    const message = getUserFriendlyErrorMessage(error)
    window.showErrorMessage(message)
  }
}

/**
 * 重置 Token 使用统计命令
 */
async function resetTokenStats() {
  try {
    logger.info('Requesting to reset token usage statistics')

    const confirmed = await window.showWarningMessage(
      l10n.t('Are you sure you want to reset all Token usage statistics?'),
      { modal: true },
      l10n.t('Reset'),
    )

    if (confirmed) {
      await tokenTracker.reset()
      window.showInformationMessage(l10n.t('Token usage statistics have been reset'))
      logger.info('Token usage statistics reset successfully')
    }
    else {
      logger.debug('Token usage statistics reset cancelled by user')
    }
  }
  catch (error: unknown) {
    logger.error('Failed to reset token stats', error)
    const message = getUserFriendlyErrorMessage(error)
    window.showErrorMessage(message)
  }
}

/**
 * 生成日报命令
 * @param context 扩展上下文
 */
async function generateDailyReport(context: ExtensionContext) {
  const controller = abortManager.createController()

  try {
    logger.info('Starting daily report generation')

    // 验证配置
    const validation = validateConfig([
      { key: 'service.apiKey', required: true, errorMessage: l10n.t('API Key is required. Please configure it in settings.') },
      { key: 'service.baseURL', required: true, errorMessage: l10n.t('Base URL is required. Please configure it in settings.') },
      { key: 'service.model', required: true, errorMessage: l10n.t('Model is required. Please configure it in settings.') },
    ])
    if (!validation.isValid) {
      logger.warn('Configuration validation failed', { error: validation.error })
      window.showErrorMessage(validation.error!)
      return
    }

    // 获取仓库
    const repo = await getRepo(context)

    // 获取今天的提交记录
    const commits = await getTodayCommits(repo)

    logger.debug('Retrieved today\'s commits', { count: commits.length })

    if (commits.length === 0) {
      const proceed = await window.showInformationMessage(
        l10n.t('No commits found today. Generate report anyway?'),
        l10n.t('Yes'),
        l10n.t('No'),
      )
      if (proceed !== l10n.t('Yes')) {
        return
      }
    }

    // 生成日报
    const reportResult = await ProgressHandler.withProgress(
      '',
      async (progress, token) => {
        progress.report({ message: l10n.t('Generating daily report...') })

        token?.onCancellationRequested(() => {
          controller.abort()
        })

        logger.info('Generating daily report from commits')

        const prompts = await generateDailyReportPrompt(commits)

        const apiResult = await ChatGPTAPI(prompts, { signal: controller.signal })

        logger.debug('Daily report response received', {
          content: apiResult.content,
        })

        // 解析 JSON 响应
        try {
          const parsed = JSON.parse(apiResult.content.trim()) as DailyReportResult
          return parsed
        }
        catch (error) {
          logger.error('Failed to parse daily report JSON', error)
          throw new Error(l10n.t('Failed to parse daily report response.'))
        }
      },
      true,
    )

    if (!reportResult || !reportResult.items || reportResult.items.length === 0) {
      logger.warn('No report generated')
      window.showWarningMessage(l10n.t('Failed to generate daily report.'))
      return
    }

    // 格式化日报显示
    const reportSection = reportResult.items
      .map((item, index) => `${index + 1}. ${item}`)
      .join('\n')

    // 格式化提交记录（显示时样式弱化）
    const commitsSection = commits.length > 0
      ? `\n\n${l10n.t('Commits Today')} (${commits.length}):\n${commits.map((commit, index) =>
        `${index + 1}. [${commit.hash.substring(0, 7)}] ${commit.message} - ${commit.author}`,
      ).join('\n')}`
      : ''

    const formattedReport = `${l10n.t('Summary')}:\n${reportSection}${commitsSection}`

    // 显示日报并提供操作选项
    const today = new Date().toISOString().split('T')[0]
    const selected = await window.showInformationMessage(
      l10n.t('Daily Report ({0})', today),
      { modal: true, detail: formattedReport },
      l10n.t('Copy to Clipboard'),
    )

    if (selected === l10n.t('Copy to Clipboard')) {
      await env.clipboard.writeText(reportSection)
      window.showInformationMessage(l10n.t('Report copied to clipboard'))
      logger.info('Daily report copied to clipboard')
    }

    logger.info('Daily report generated successfully')
  }
  catch (error: unknown) {
    if (shouldSilenceError(error)) {
      return
    }

    logger.error('Failed to generate daily report', error)
    window.showErrorMessage(getUserFriendlyErrorMessage(error))
  }
  finally {
    abortManager.clear(controller)
  }
}

// 导出命令函数供扩展入口文件使用
export {
  generateDailyReport,
  resetTokenStats,
  reviewAndCommit,
  selectAvailableModel,
  showTokenStats,
}
