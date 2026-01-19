import type { ChatCompletionMessageParam } from 'openai/resources'
import OpenAI from 'openai'
import { config } from './config'
import { API_CONFIG } from './constants'

/**
 * 创建 OpenAI API 客户端实例
 * @returns OpenAI 客户端实例
 */
export function createOpenAIApi(): OpenAI {
  const serviceConfig = config.getServiceConfig()

  return new OpenAI({
    apiKey: serviceConfig.apiKey,
    baseURL: serviceConfig.baseURL,
  })
}

/**
 * Token 使用统计接口
 */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cachedTokens?: number
}

/**
 * 调用 ChatGPT 流式 API
 * @param messages 聊天消息数组，包含系统提示和用户输入
 * @param onChunk 每次接收到内容块时的回调函数
 * @param options 可选配置对象
 * @param options.signal 可选的中止信号，用于取消请求
 * @param options.timeout 请求超时时间（毫秒），默认 60 秒
 * @returns 包含完整响应内容和 token 使用统计的对象
 * @throws 如果请求失败则抛出错误（中止除外）
 */
export async function ChatGPTStreamAPI(
  messages: ChatCompletionMessageParam[],
  onChunk: (chunk: string) => void,
  options: { signal?: AbortSignal, timeout?: number } = {},
): Promise<{ content: string, usage?: TokenUsage }> {
  const { signal, timeout = API_CONFIG.DEFAULT_TIMEOUT } = options
  const openai = createOpenAIApi()
  const { model } = config.getServiceConfig()
  const temperature = API_CONFIG.DEFAULT_TEMPERATURE

  // 创建超时控制器
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), timeout)

  // 如果用户提供了信号，监听它的中止事件
  if (signal) {
    signal.addEventListener('abort', () => timeoutController.abort(), { once: true })
  }

  try {
    // 创建流式聊天完成请求
    const stream = await openai.chat.completions.create({
      model,
      messages: messages as ChatCompletionMessageParam[],
      temperature,
      stream: true,
      stream_options: { include_usage: true },
    }, { signal: timeoutController.signal })

    let fullContent = ''
    let usage: TokenUsage | undefined

    try {
      // 迭代处理流式响应
      for await (const chunk of stream) {
        if (timeoutController.signal.aborted) {
          break
        }
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          fullContent += content
          onChunk(content)
        }

        // 捕获最后一个 chunk 中的 usage 信息
        if (chunk.usage) {
          const rawUsage = chunk.usage as any
          usage = {
            promptTokens: rawUsage.prompt_tokens || 0,
            completionTokens: rawUsage.completion_tokens || 0,
            totalTokens: rawUsage.total_tokens || 0,
            cachedTokens: rawUsage.prompt_tokens_details?.cached_tokens || 0,
          }
        }
      }
    }
    catch (error) {
      // 如果是中止操作，返回已接收的内容
      if (timeoutController.signal.aborted) {
        return { content: fullContent, usage }
      }
      throw error
    }

    return { content: fullContent, usage }
  }
  finally {
    // 清理超时定时器
    clearTimeout(timeoutId)
  }
}

/**
 * 调用 ChatGPT 非流式 API（用于获取结构化响应）
 * @param messages 聊天消息数组，包含系统提示和用户输入
 * @param options 可选配置对象
 * @param options.signal 可选的中止信号，用于取消请求
 * @param options.timeout 请求超时时间（毫秒），默认 60 秒
 * @param options.responseFormat 响应格式，'json' 或 'text'，默认为 'json'
 * @returns 包含完整响应内容和 token 使用统计的对象
 * @throws 如果请求失败则抛出错误（中止除外）
 */
export async function ChatGPTAPI(
  messages: ChatCompletionMessageParam[],
  options: { signal?: AbortSignal, timeout?: number, responseFormat?: 'json' | 'text' } = {},
): Promise<{ content: string, usage?: TokenUsage }> {
  const { signal, timeout = API_CONFIG.DEFAULT_TIMEOUT, responseFormat = 'json' } = options
  const openai = createOpenAIApi()
  const { model } = config.getServiceConfig()
  const temperature = API_CONFIG.DEFAULT_TEMPERATURE

  // 创建超时控制器
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), timeout)

  // 如果用户提供了信号，监听它的中止事件
  if (signal) {
    signal.addEventListener('abort', () => timeoutController.abort(), { once: true })
  }

  try {
    // 创建聊天完成请求
    const requestConfig: any = {
      model,
      messages: messages as ChatCompletionMessageParam[],
      temperature,
      stream: false,
    }
    
    // 只在需要 JSON 格式时添加 response_format
    if (responseFormat === 'json') {
      requestConfig.response_format = { type: 'json_object' }
    }
    
    const response = await openai.chat.completions.create(requestConfig, { signal: timeoutController.signal })

    // 提取 token 使用情况
    let usage: TokenUsage | undefined
    if (response.usage) {
      const rawUsage = response.usage as any

      // 支持 OpenAI 和 DeepSeek 两种格式
      const cachedTokens = rawUsage.prompt_tokens_details?.cached_tokens
        || rawUsage.prompt_cache_hit_tokens
        || 0

      usage = {
        promptTokens: rawUsage.prompt_tokens || 0,
        completionTokens: rawUsage.completion_tokens || 0,
        totalTokens: rawUsage.total_tokens || 0,
        cachedTokens,
      }
    }

    return {
      content: response.choices[0]?.message?.content || '',
      usage,
    }
  }
  finally {
    // 清理超时定时器
    clearTimeout(timeoutId)
  }
}

/**
 * 获取可用的模型列表
 * @returns 模型 ID 数组
 */
export async function getAvailableModels() {
  const openai = createOpenAIApi()
  const models = await openai.models.list()
  const modelNames = models.data.map(model => model.id)
  return modelNames
}
