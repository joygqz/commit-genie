# Commit Genie

Generate [Conventional Commits](https://www.conventionalcommits.org/) messages from your changes with AI. Works with any OpenAI-compatible API — DeepSeek, OpenAI, OpenRouter, Groq, Ollama, and more.

## Quick Start

1. Install from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=joygqz.commit-genie)
2. Set `commit-genie.baseURL`, `commit-genie.apiKey` and `commit-genie.model` in Settings
3. Stage your changes and click the ✨ button in the Source Control panel

The message streams directly into the commit input box — edit it if needed, then commit.

## Features

- **Any provider** — point `baseURL` at any OpenAI-compatible endpoint, including local models via Ollama
- **Token-efficient** — lock files and binaries are stripped from the diff; the prompt is built for provider-side prefix caching
- **Streaming** — watch the message appear as it's generated, cancel anytime
- **Falls back to unstaged changes** when nothing is staged

## Settings

| Setting | Description |
| --- | --- |
| `commit-genie.baseURL` | API endpoint, e.g. `https://api.deepseek.com`, `https://api.openai.com/v1`, `http://localhost:11434/v1` |
| `commit-genie.apiKey` | API key |
| `commit-genie.model` | Model ID, e.g. `deepseek-chat` |
| `commit-genie.language` | Commit message language (default `English`), e.g. `简体中文`, `日本語` |
| `commit-genie.useEmoji` | Gitmoji prefix (✨ feat, 🐛 fix, …), default off |
| `commit-genie.instructions` | Extra prompt instructions, e.g. team conventions |

## Commands

- `Commit Genie: Generate Commit Message` — also available as the ✨ button in Source Control
- `Commit Genie: Select Model` — pick from the models your provider offers

## License

[MIT](LICENSE)
