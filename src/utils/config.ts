import { ConfigurationTarget, workspace } from 'vscode'
import { EXTENSION_ID } from './constants'

/**
 * 服务配置接口
 */
export interface ServiceConfig {
  apiKey: string
  baseURL: string
  model: string
}

/**
 * 格式配置接口
 */
export interface FormatConfig {
  outputLanguage: string
}

/**
 * 提交消息配置接口
 */
export interface CommitConfig {
  enableEmojiPrefix: boolean
  customPrompt: string
}

/**
 * 代码审查配置接口
 */
export interface ReviewConfig {
  customPrompt: string
}

/**
 * 日报配置接口
 */
export interface ReportConfig {
  maxWords: number
  customPrompt: string
}

class ConfigManager {
  private readonly section = EXTENSION_ID

  /**
   * 获取配置项的值
   * @param key 配置键，如 'service.apiKey'（不包含扩展 ID 前缀）
   * @param defaultValue 默认值，当配置项不存在时返回
   * @returns 配置项的值
   * @example
   * ```typescript
   * const apiKey = config.get<string>('service.apiKey', '')
   * ```
   */
  get<T>(key: string, defaultValue?: T): T {
    return workspace.getConfiguration(this.section).get<T>(key, defaultValue as T)
  }

  /**
   * 更新配置项
   * @param key 配置键
   * @param value 新值
   * @param target 配置目标：全局、工作区或工作区文件夹，默认为全局
   * @example
   * ```typescript
   * await config.update('service.model', 'gpt-4', ConfigurationTarget.Global)
   * ```
   */
  async update<T>(
    key: string,
    value: T,
    target: ConfigurationTarget = ConfigurationTarget.Global,
  ): Promise<void> {
    await workspace.getConfiguration(this.section).update(key, value, target)
  }

  /**
   * 获取服务相关配置
   * @returns 服务配置对象
   */
  getServiceConfig(): ServiceConfig {
    return {
      apiKey: this.get<string>('service.apiKey', ''),
      baseURL: this.get<string>('service.baseURL', 'https://api.deepseek.com'),
      model: this.get<string>('service.model', 'deepseek-chat'),
    }
  }

  /**
   * 获取格式相关配置
   * @returns 格式配置对象
   */
  getFormatConfig(): FormatConfig {
    return {
      outputLanguage: this.get<string>('format.outputLanguage', '简体中文'),
    }
  }

  /**
   * 获取提交消息相关配置
   * @returns 提交消息配置对象
   */
  getCommitConfig(): CommitConfig {
    return {
      enableEmojiPrefix: this.get<boolean>('commit.enableEmojiPrefix', false),
      customPrompt: this.get<string>('commit.customPrompt', ''),
    }
  }

  /**
   * 获取代码审查相关配置
   * @returns 审查配置对象
   */
  getReviewConfig(): ReviewConfig {
    return {
      customPrompt: this.get<string>('review.customPrompt', ''),
    }
  }

  /**
   * 获取日报相关配置
   * @returns 日报配置对象
   */
  getReportConfig(): ReportConfig {
    return {
      maxWords: this.get<number>('report.maxWords', 200),
      customPrompt: this.get<string>('report.customPrompt', ''),
    }
  }
}

export const config = new ConfigManager()
