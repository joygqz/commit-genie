import type { ChatCompletionMessageParam } from 'openai/resources'
import type { GitCommitLog } from './utils/git'
import { config } from './utils/config'
import { COMMIT_FORMAT } from './utils/constants'

/**
 * 代码 review 结果接口
 */
export interface CodeReviewResult {
  /** 是否通过 review */
  passed: boolean
  /** 问题列表 */
  issues: string[]
  /** 建议列表 */
  suggestions: string[]
}

/**
 * 审查和提交结果接口
 */
export interface ReviewAndCommitResult {
  review: CodeReviewResult
  commitMessage: string
}

/**
 * 日报结果接口
 */
export interface DailyReportResult {
  /** 工作项列表 */
  items: string[]
  /** 总提交数 */
  totalCommits: number
}

/**
 * 生成统一的代码审查 + commit 消息提示词
 * @param diff Git diff 内容
 * @returns 聊天消息数组
 */
export async function generateReviewAndCommitPrompt(
  diff: string,
): Promise<ChatCompletionMessageParam[]> {
  const formatConfig = config.getFormatConfig()
  const commitConfig = config.getCommitConfig()
  const reviewConfig = config.getReviewConfig()

  const trimmedDiff = diff.trim() || '[empty diff provided]'

  // 构建语言提示
  const isChinese = formatConfig.outputLanguage.includes('中文')
  const languageNote = isChinese ? ' 请在中文与英文或数字之间保留空格。' : ''

  // 构建提交类型列表
  const commitTypes = [
    { type: 'feat', description: 'new feature', emoji: '✨' },
    { type: 'fix', description: 'bug fix', emoji: '🐛' },
    { type: 'docs', description: 'documentation', emoji: '📚' },
    { type: 'style', description: 'formatting / code style', emoji: '💄' },
    { type: 'refactor', description: 'code refactoring', emoji: '♻️' },
    { type: 'perf', description: 'performance improvement', emoji: '⚡' },
    { type: 'test', description: 'testing', emoji: '✅' },
    { type: 'build', description: 'build system', emoji: '📦' },
    { type: 'ci', description: 'CI configuration', emoji: '👷' },
    { type: 'chore', description: 'maintenance', emoji: '🔧' },
    { type: 'revert', description: 'revert previous commit', emoji: '⏪' },
  ]

  const commitTypesList = commitTypes
    .map(({ type, description, emoji }) => {
      const prefix = commitConfig.enableEmojiPrefix ? `${emoji} ` : ''
      return `  - ${prefix}${type}: ${description}`
    })
    .join('\n')

  const emojiInstruction = commitConfig.enableEmojiPrefix
    ? 'Prefix the subject with the matching emoji from the list above.'
    : 'Do not prefix the subject with emojis.'

  // 自定义提示
  const reviewCustomPrompt = reviewConfig.customPrompt.trim()
  const commitCustomPrompt = commitConfig.customPrompt.trim()

  const systemContent = `You are a code review and commit message generator. Analyze git diff changes and produce both review feedback and a Conventional Commit message.

CRITICAL: ALL text output (review issues, suggestions, commit message) MUST be in ${formatConfig.outputLanguage}.${languageNote} ONLY technical terms (commit types like feat/fix, code identifiers, file paths) remain in English.

## Task 1 — Code Review

CAREFULLY examine ONLY the ADDED or MODIFIED lines in the diff for syntax errors.

IMPORTANT: In Git diff format:
- Lines starting with "+" are ADDED (NEW code) — REVIEW these
- Lines starting with "-" are DELETED (OLD code) — IGNORE these
- Lines starting with " " (space) are UNCHANGED context — IGNORE these
- ONLY check syntax errors in lines that start with "+"

Check for these visible errors in ADDED lines:
  - Brackets: missing/extra/mismatched ( ) [ ] { }
  - Quotes: missing/extra/mismatched " ' \`
  - Punctuation: missing/extra semicolons, commas, colons, periods
  - Operators: typos like == = (single equals in condition), + - * / % & | misuse
  - Keywords: typos like fucntion, cosnt, retrun, improt, exoprt, calss, udefined, nul
  - Strings: unterminated strings, wrong quote types, unescaped quotes
  - Comments: unclosed /* or mismatched comment markers
  - Regex: unclosed regex /pattern or wrong flags
  - Template literals: wrong \` usage or \${ without }
  - JSX/TSX: unclosed tags <div> without </div>, wrong self-closing />
  - Type annotations: missing : in TypeScript, wrong <> generic syntax
  - Arrow functions: => vs = confusion, missing parentheses
  - Duplicate: duplicate keys in objects, duplicate case in switch
  - Return: return outside function (visible in diff)
  - Break/continue: outside loop (visible in diff)

Rules:
- Scan EACH line starting with "+" in the diff for syntax mistakes
- IGNORE lines starting with "-" (deleted/old code) — don't review removed code
- Report errors you can DIRECTLY see in the ADDED lines (no guessing)
- When lacking context or uncertain, pass the review (set passed=true)
- DO NOT report: undefined variables/functions (you can't see imports/definitions), code style, logic bugs, performance, code smells, potential issues
- Set passed=false ONLY for clear syntax errors in ADDED lines
- Default when no errors found: passed=true, issues=[], suggestions=[]
- Each issue MUST include: short description + affected file/line
- Write ALL descriptions in ${formatConfig.outputLanguage}${reviewCustomPrompt
  ? `

Additional review guidance:
${reviewCustomPrompt}`
  : ''}

## Task 2 — Commit Message

Format: type(scope): subject

Subject line rules:
- Follow Conventional Commits specification
- Structure: type(scope): subject
- Supported types:
${commitTypesList}
- ${emojiInstruction}
- Use imperative mood (e.g., "add" not "added" or "adds")
- Max ${COMMIT_FORMAT.MAX_SUBJECT_LENGTH} characters
- No period at the end
- Lowercase first letter after colon
- Be specific and concise about WHAT changed
- Write in ${formatConfig.outputLanguage}

Body rules (optional, add only when needed):
- Separate from subject with ONE blank line
- MUST use bullet point format: each line starts with "- "
- Wrap at ${COMMIT_FORMAT.MAX_BODY_LINE_LENGTH} characters per line
- Explain WHY the change was made, not HOW
- Include context, motivation, or consequences
- Write in ${formatConfig.outputLanguage}

When to include body:
- Complex changes needing explanation
- Breaking changes (BREAKING CHANGE: ...)
- Multiple related changes
- Important context or reasoning

When to skip body:
- Simple, self-explanatory changes
- Single-line fixes
- Trivial updates${commitCustomPrompt
  ? `

Additional commit guidance:
${commitCustomPrompt}`
  : ''}

## Output Format

TypeScript type definition (for your understanding):
\`\`\`typescript
interface Output {
  review: {
    passed: boolean;           // true = no errors, false = has errors
    issues: string[];          // array of plain text strings describing errors
    suggestions: string[];     // array of plain text strings with suggestions
  };
  commitMessage: string;       // single string, may contain \\n for body
}
\`\`\`

Return JSON matching above type (no markdown fences):

Simple change example:
{
  "review": {
    "passed": true,
    "issues": [],
    "suggestions": []
  },
  "commitMessage": "feat(auth): add OAuth2 support"
}

Complex change example with body (body MUST use "- " format):
{
  "review": {
    "passed": true,
    "issues": [],
    "suggestions": []
  },
  "commitMessage": "feat(auth): add OAuth2 support\n\n- implement OAuth2 authentication flow for third-party login\n- add support for Google and GitHub providers\n- improve security with token-based authentication\n- enhance user experience with social login options"
}

Remember: Set review.passed based on findings. ALL text content MUST be in ${formatConfig.outputLanguage}.`

  return [
    {
      role: 'system',
      content: systemContent,
    } satisfies ChatCompletionMessageParam,
    {
      role: 'user',
      content: trimmedDiff,
    } satisfies ChatCompletionMessageParam,
  ]
}

/**
 * 生成日报提示词
 * @param commits 当日的 Git 提交日志
 * @returns 聊天消息数组
 */
export async function generateDailyReportPrompt(
  commits: GitCommitLog[],
): Promise<ChatCompletionMessageParam[]> {
  const formatConfig = config.getFormatConfig()
  const reportConfig = config.getReportConfig()

  // 构建提交信息摘要
  const commitSummary = commits.map((commit, index) => {
    return `${index + 1}. ${commit.message} (${commit.hash.substring(0, 7)})`
  }).join('\n')

  const commitCount = commits.length

  // 构建自定义提示
  const customPromptSection = reportConfig.customPrompt.trim()
    ? `\n\n${reportConfig.customPrompt}`
    : ''

  const systemContent = `You are a professional daily report generator. Based on today's Git commit logs, generate a concise and professional daily work report.

## Requirements

1. **Output Language**: ALL content MUST be in ${formatConfig.outputLanguage}
2. **Format**: Use numbered list format (1. 2. 3. ...)
3. **Word Limit**: Total content MUST NOT exceed ${reportConfig.maxWords} words (Chinese characters count as 1 word each)
4. **Content Style**:
   - Be concise and professional
   - Focus on WHAT was accomplished, not technical details
   - Summarize related commits into logical work items
   - Use action verbs (completed, implemented, fixed, optimized, etc.)
   - Avoid technical jargon when possible
5. **Structure**:
   - Each numbered item should represent a major task or feature
   - Group related commits together
   - Prioritize important work first${customPromptSection}

## Today's Commits (${commitCount} total)

${commitSummary || 'No commits today'}

## Output Format

TypeScript type definition (for your understanding):
\`\`\`typescript
interface Output {
  items: string[];        // array of work items, each item is a concise summary
  totalCommits: number;   // total number of commits processed
}
\`\`\`

Return JSON matching above type (no markdown fences):

{
  "items": [
    "完成了用户认证模块的开发，实现了登录和注册功能。",
    "修复了数据列表分页显示的 bug。",
    "优化了首页加载性能，提升了用户体验。"
  ],
  "totalCommits": ${commitCount}
}

Remember: Stay within ${reportConfig.maxWords} words and use ${formatConfig.outputLanguage}.`

  return [
    {
      role: 'system',
      content: systemContent,
    } satisfies ChatCompletionMessageParam,
    {
      role: 'user',
      content: commitCount > 0
        ? `Please generate a daily report based on the ${commitCount} commits above.`
        : 'No commits today, please generate a brief daily report indicating no development work was done.',
    } satisfies ChatCompletionMessageParam,
  ]
}
