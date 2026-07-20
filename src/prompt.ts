import type { Config } from './config'
import type { ChatMessage } from './llm'

// Static prefix — keep it byte-identical across requests so providers with
// automatic prefix caching (OpenAI, DeepSeek, …) can reuse it. All
// configuration-dependent text goes at the end of the system message.
const SYSTEM_PROMPT = `You write git commit messages from diffs.

Output ONLY the raw commit message — no code fences, no quotes, no commentary.

Format (Conventional Commits):
<type>(<scope>): <subject>

<body>

Rules:
- type: feat, fix, docs, style, refactor, perf, test, build, ci, chore or revert
- scope: the main module or area touched; omit when unclear
- subject: imperative mood, concise, no trailing period; keep the whole first line within 72 characters
- body: only when the change needs context — "- " bullets explaining what and why, wrapped at 100 characters; otherwise output the subject line alone
- describe only what the diff actually changes; never invent details`

export function buildMessages(diff: string, config: Config): ChatMessage[] {
  const { language, useEmoji, instructions } = config

  const extras = [
    useEmoji && '- prefix the type with its gitmoji, as in "✨ feat(api): add retry": ✨ feat, 🐛 fix, 📝 docs, 💄 style, ♻️ refactor, ⚡ perf, ✅ test, 📦 build, 👷 ci, 🔧 chore, ⏪ revert',
    language && `- write the subject and body in ${language}; keep type, scope and code identifiers in English`,
    instructions && `\nAdditional instructions (highest priority):\n${instructions}`,
  ].filter(Boolean).join('\n')

  return [
    { role: 'system', content: extras ? `${SYSTEM_PROMPT}\n${extras}` : SYSTEM_PROMPT },
    { role: 'user', content: diff },
  ]
}
