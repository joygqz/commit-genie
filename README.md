# Commit Genie

Generate [Conventional Commits](https://www.conventionalcommits.org/) messages from your changes with AI. Works with any OpenAI-compatible API — DeepSeek, OpenAI, OpenRouter, Groq, Ollama, and more.

## Quick Start

1. Install from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=joygqz.commit-genie)
2. Set `commit-genie.baseURL` and `commit-genie.apiKey` in Settings (local endpoints need no key)
3. Run **Commit Genie: Select Model** from the Command Palette to pick a model
4. Stage your changes and click the sparkle icon in the Source Control title bar

The message streams straight into the commit input box — edit it if needed, then commit.

## Features

- **Any provider** — point `baseURL` at any OpenAI-compatible endpoint, including local models via Ollama
- **Token-efficient** — lock files and binaries collapse to a one-line change summary, very large diffs are truncated, and the prompt is laid out for provider-side prefix caching
- **Streaming** — the message appears in the commit box as it is generated
- **Unstaged fallback** — with nothing staged, the working-tree diff is used instead
- **Your conventions** — choose the output language, add gitmoji, and append your own prompt instructions

## Settings

| Setting | Description | Default |
| --- | --- | --- |
| `commit-genie.baseURL` | API endpoint, e.g. `https://api.deepseek.com`, `https://api.openai.com/v1`, `http://localhost:11434/v1` | — |
| `commit-genie.apiKey` | API key. Leave empty for local endpoints such as Ollama | — |
| `commit-genie.model` | Model ID, e.g. `deepseek-v4-pro`. Best set via **Select Model** | — |
| `commit-genie.language` | Language for the subject and body. Type, scope and code identifiers stay in English | `English` |
| `commit-genie.useEmoji` | Prefix the commit type with a gitmoji, e.g. `✨ feat: …` | `false` |
| `commit-genie.instructions` | Extra instructions appended to the prompt, such as team conventions or a ticket-number format | — |

## Commands

- **Commit Genie: Generate Commit Message** — also the sparkle icon in the Source Control title bar
- **Commit Genie: Select Model** — pick from the models your provider offers

## Development

Use Node.js 24 and the pnpm version declared in `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm compile
pnpm verify
pnpm ext:package
```

`compile` creates a development bundle; `verify` runs the available static checks and unit tests; `build` verifies and creates the production bundle. `ext:package` builds a VSIX through the same verification gate used in CI. Use `watch` during development.

See [Architecture](docs/ARCHITECTURE.md) for module boundaries and lifecycle rules, and [Contributing](CONTRIBUTING.md) for validation and release conventions.

Maintained by **Quincy Zhang**. The publisher ID remains `joygqz`; the Marketplace publisher display name is managed separately from source code.

## Feedback and License

- Report bugs or request features: [GitHub Issues](https://github.com/joygqz/commit-genie/issues)
- [MIT](LICENSE)
