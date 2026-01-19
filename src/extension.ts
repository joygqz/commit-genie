import type * as vscode from 'vscode'
import { commands } from 'vscode'
import * as Commands from './commands'
import { COMMANDS } from './utils/constants'
import { logger } from './utils/logger'
import { tokenTracker } from './utils/token-tracker'

/**
 * 扩展激活函数
 * @param context 扩展上下文，用于管理扩展的生命周期
 */
export function activate(context: vscode.ExtensionContext) {
  logger.info('Commit Genie extension activated')

  // 初始化 Token 状态栏并加载持久化数据
  const statusBarItem = tokenTracker.initialize(context)
  context.subscriptions.push(statusBarItem)

  // 注册命令
  context.subscriptions.push(
    // 审查代码并生成 commit 消息
    commands.registerCommand(
      COMMANDS.REVIEW_AND_COMMIT,
      Commands.reviewAndCommit.bind(null, context),
    ),
    // 选择可用模型
    commands.registerCommand(
      COMMANDS.SELECT_AVAILABLE_MODEL,
      Commands.selectAvailableModel,
    ),
    // 显示 Token 统计
    commands.registerCommand(
      COMMANDS.SHOW_TOKEN_STATS,
      Commands.showTokenStats,
    ),
    // 重置 Token 统计
    commands.registerCommand(
      COMMANDS.RESET_TOKEN_STATS,
      Commands.resetTokenStats,
    ),
    // 生成日报
    commands.registerCommand(
      COMMANDS.GENERATE_DAILY_REPORT,
      Commands.generateDailyReport.bind(null, context),
    ),
  )
}

/**
 * 扩展注销函数
 * VS Code 允许返回 Promise，会等待异步操作完成
 */
export async function deactivate() {
  logger.info('Commit Genie extension deactivating')

  // 确保 token 统计数据已保存
  await tokenTracker.ensureSaved()

  tokenTracker.dispose()
  logger.dispose()
}
