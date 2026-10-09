# Commit Genie

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/joygqz.commit-genie?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=joygqz.commit-genie)
[![Open VSX](https://img.shields.io/open-vsx/v/joygqz/commit-genie?label=Open%20VSX)](https://open-vsx.org/extension/joygqz/commit-genie)
[![GitHub Release](https://img.shields.io/github/v/release/joygqz/commit-genie?label=GitHub%20Release)](https://github.com/joygqz/commit-genie/releases)

Generate [Conventional Commits](https://www.conventionalcommits.org/) messages from your changes with AI. Works with any OpenAI-compatible API — DeepSeek, OpenAI, OpenRouter, Groq, Ollama, and more.

## Features

- **Any provider** — point `baseURL` at any OpenAI-compatible endpoint, including local models via Ollama.
- **Token-efficient** — lock files and binaries collapse to a one-line change summary, very large diffs are truncated, and the prompt is laid out for provider-side prefix caching.
- **Streaming** — the message appears in the commit box as it is generated.
- **Unstaged fallback** — with nothing staged, the working-tree diff is used instead.
- **Your conventions** — choose the output language, add gitmoji, and append your own prompt instructions.

## Prerequisites

- VS Code 1.90 or newer with the built-in Git extension enabled.
- A Git repository with changes to describe.
- An OpenAI-compatible endpoint and model; hosted providers usually require an API key.

## Installation

Search for **Commit Genie** in the Extensions view (`Ctrl/Cmd+Shift+X`), or visit [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=joygqz.commit-genie) or [Open VSX](https://open-vsx.org/extension/joygqz/commit-genie). You can also install a `.vsix` from [GitHub Releases](https://github.com/joygqz/commit-genie/releases) using **Extensions: Install from VSIX…**.

## Quick Start

1. Set `commit-genie.baseURL` and `commit-genie.apiKey` in Settings (local endpoints need no key).
2. Run **Commit Genie: Select Model** from the Command Palette to pick a model.
3. Stage your changes and click the sparkle icon in the Source Control title bar.

The message streams straight into the commit input box — edit it if needed, then commit.

## Commands

| Command | Description |
| --- | --- |
| `Commit Genie: Generate Commit Message` | Also the sparkle icon in the Source Control title bar |
| `Commit Genie: Select Model` | Pick from the models your provider offers |

## Settings

| Setting | Description | Default |
| --- | --- | --- |
| `commit-genie.baseURL` | API endpoint, e.g. `https://api.deepseek.com`, `https://api.openai.com/v1`, `http://localhost:11434/v1` | `""` |
| `commit-genie.apiKey` | API key. Leave empty for local endpoints such as Ollama | `""` |
| `commit-genie.model` | Model ID, e.g. `deepseek-v4-pro`. Best set via **Select Model** | `""` |
| `commit-genie.language` | Language for the subject and body. Type, scope and code identifiers stay in English | `English` |
| `commit-genie.useEmoji` | Prefix the commit type with a gitmoji, e.g. `✨ feat: …` | `false` |
| `commit-genie.instructions` | Extra instructions appended to the prompt, such as team conventions or a ticket-number format | `""` |

## Usage

Stage the changes you want to describe, then run **Commit Genie: Generate Commit Message**. If no changes are staged, the extension uses the working-tree diff. Generated text streams into the Source Control input box; review and edit it before committing.

Set `commit-genie.language`, `commit-genie.useEmoji`, and `commit-genie.instructions` for your conventions. Starting another generation cancels the previous request.

## Security and Privacy

- Diffs are sent to the endpoint configured in `commit-genie.baseURL`; choose a provider suitable for the code you are sharing.
- API keys use the existing VS Code settings configuration. Local endpoints can leave `commit-genie.apiKey` empty.
- The extension generates text in the commit input box; you decide whether to commit it.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Missing configuration | Set `commit-genie.baseURL` and run **Commit Genie: Select Model**. |
| Provider or network error | Check the endpoint, API key, model, and the provider's error message. |
| No changes to commit | Make changes in the selected Git repository, then stage them or use the working-tree fallback. |

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

## Feedback

- Report bugs or request features: [GitHub Issues](https://github.com/joygqz/commit-genie/issues)

## License

[MIT](LICENSE)

Maintained by **Quincy Zhang**.
