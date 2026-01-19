# Commit Genie

[![GitHub last commit](https://img.shields.io/github/last-commit/joygqz/commit-genie?style=flat-square)](https://github.com/joygqz/commit-genie)
[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/joygqz.commit-genie?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=joygqz.commit-genie)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/joygqz.commit-genie?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=joygqz.commit-genie)
[![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/joygqz.commit-genie?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=joygqz.commit-genie&ssr=false#review-details)

AI 驱动的提交消息生成器，支持代码审查的 VS Code 扩展。

## ✨ 特性

- 🤖 **AI 驱动** - 兼容 OpenAI、DeepSeek 等 OpenAI 兼容 API
- 🔍 **代码审查** - 提交前自动检测语法错误
- 📝 **日报生成** - 自动基于当日 Git 提交生成工作日报
- 🌐 **多语言** - 支持 19+ 种语言生成提交消息
- ⚡ **实时生成** - 流式生成，支持取消操作
- 🎨 **高度自定义** - 支持 Emoji、自定义提示、模型选择

## 🚀 快速开始

1. 从 [VS Code 市场](https://marketplace.visualstudio.com/items?itemName=joygqz.commit-genie) 安装
2. 配置 API（设置）：
   - `commit-genie.service.apiKey` - 你的 API 密钥
   - `commit-genie.service.baseURL` - API 端点（默认：`https://api.deepseek.com`）
3. 选择模型：运行 `Commit Genie: 选择可用模型`
4. 暂存更改并点击源代码管理中的 ✨ 图标

## 📋 使用方法

1. **暂存更改** 在源代码管理中
2. **点击** ✨ 图标或运行 `Commit Genie: 审查并提交`
3. **审查** - AI 检查语法错误，如果发现问题可以继续或修复
4. **提交** - AI 实时生成消息，可根据需要编辑

**命令：**

- `Commit Genie: 审查并提交` - 生成提交消息并进行审查
- `Commit Genie: 生成日报` - 基于当日 Git 提交生成工作日报
- `Commit Genie: 选择可用模型` - 浏览和切换 AI 模型
- `Commit Genie: 显示 Token 使用统计` - 查看 Token 使用统计
- `Commit Genie: 重置 Token 使用统计` - 清除所有 Token 统计

## ⚙️ 配置

### 必需设置

```jsonc
{
  "commit-genie.service.apiKey": "sk-...", // 你的 API 密钥
  "commit-genie.service.baseURL": "https://api.deepseek.com", // API 端点
  "commit-genie.service.model": "deepseek-chat" // 模型名称
}
```

**支持的服务商：** DeepSeek、OpenAI 或任何兼容 OpenAI 的 API

### 可选设置

**格式：**

- `format.outputLanguage` - 消息语言（默认：简体中文）
  - 支持：简体中文、繁體中文、English、日本語、한국어 以及其他 14 种语言

**审查：**

- `review.customPrompt` - 额外的审查指令（默认：空）
  - AI 会自动检查 diff 中可见的语法错误
  - 如有需要，可在此添加自定义要求

**提交：**

- `commit.enableEmojiPrefix` - 添加 emoji 前缀（例如：✨ feat、🐛 fix）（默认：`false`）
- `commit.customPrompt` - 额外的提交消息指导（默认：空）
  - 自动遵循 Conventional Commits 格式
  - 如有需要，可在此添加项目特定要求

**日报：**

- `report.maxWords` - 日报内容最大字数限制（默认：`200`，范围：50-1000）
- `report.customPrompt` - 额外的日报生成指导（默认：空）
  - 自动生成有序列表格式的日报
  - 可添加特定要求，如"需要包含工作时长"、"突出重点任务"等

## 🌍 支持的语言

English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Italiano, Nederlands, Português, Tiếng Việt, Español, Svenska, Русский, Bahasa, Polski, Türkçe, ไทย, Čeština

## 💖 支持

如果这个项目对你的工作流程有帮助，可以考虑请我喝杯咖啡

[![赞助](https://img.shields.io/badge/Sponsor-Support_Author-946ce6?style=for-the-badge&logo=github-sponsors)](https://afdian.com/a/joygqz)

你的支持让我保持动力来维护和改进这个项目！
