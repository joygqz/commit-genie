# Commit Genie

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/joygqz.commit-genie?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=joygqz.commit-genie)
[![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/joygqz.commit-genie?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=joygqz.commit-genie)
[![Visual Studio Marketplace Rating](https://img.shields.io/visual-studio-marketplace/r/joygqz.commit-genie?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=joygqz.commit-genie&ssr=false#review-details)

Generate [Conventional Commits](https://www.conventionalcommits.org/) messages from your changes with AI. Works with any OpenAI-compatible API — DeepSeek, OpenAI, OpenRouter, Groq, Ollama, and more.

## Quick Start

1. Install from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=joygqz.commit-genie)
2. Set `commit-genie.apiKey` in Settings (plus `baseURL` and `model` if you don't use DeepSeek)
3. Stage your changes and click the ✨ button in the Source Control panel

The message streams directly into the commit input box — edit it if needed, then commit.

## Features

- **Any provider** — point `baseURL` at any OpenAI-compatible endpoint, including local models via Ollama
- **Token-efficient** — lock files and binaries are stripped from the diff; the prompt is built for provider-side prefix caching
- **Streaming** — watch the message appear as it's generated, cancel anytime
- **Falls back to unstaged changes** when nothing is staged

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `commit-genie.baseURL` | `https://api.deepseek.com` | API endpoint, e.g. `https://api.openai.com/v1`, `http://localhost:11434/v1` |
| `commit-genie.apiKey` | — | API key |
| `commit-genie.model` | `deepseek-chat` | Model ID |
| `commit-genie.language` | `English` | Commit message language, e.g. `简体中文`, `日本語` |
| `commit-genie.useEmoji` | `false` | Gitmoji prefix (✨ feat, 🐛 fix, …) |
| `commit-genie.instructions` | — | Extra prompt instructions, e.g. team conventions |

## Commands

- `Commit Genie: Generate Commit Message` — also available as the ✨ button in Source Control
- `Commit Genie: Select Model` — pick from the models your provider offers

## License

[MIT](LICENSE)
