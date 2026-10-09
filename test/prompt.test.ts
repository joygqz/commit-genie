import { expect, it } from 'vitest'
import { buildMessages } from '../src/prompt'

it('keeps diff text in the user message and applies configured conventions', () => {
  const messages = buildMessages('diff content', { baseURL: '', apiKey: '', model: '', language: '简体中文', useEmoji: true, instructions: 'Include ticket ID' })
  expect(messages[0].content).toContain('简体中文')
  expect(messages[0].content).toContain('gitmoji')
  expect(messages[0].content).toContain('Include ticket ID')
  expect(messages[1]).toEqual({ role: 'user', content: 'diff content' })
})
