import { describe, expect, it } from 'vitest'

import { stripToolDetailsForDisplay } from './use-chat-history'
import type { ChatMessage } from '../types'

describe('stripToolDetailsForDisplay', () => {
  it('removes embedded assistant tool details when tool messages are hidden', () => {
    const message = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'I checked it.' },
        {
          type: 'toolCall',
          id: 'tool-1',
          name: 'terminal',
          arguments: { command: 'pwd' },
        },
      ],
      __streamToolCalls: [{ id: 'tool-2', name: 'terminal' }],
      streamToolCalls: [{ id: 'tool-3', name: 'browser' }],
    } as ChatMessage

    const result = stripToolDetailsForDisplay(message, false)

    expect(result).not.toBe(message)
    expect(result.content).toEqual([{ type: 'text', text: 'I checked it.' }])
    expect(
      (result as Record<string, unknown>).__streamToolCalls,
    ).toBeUndefined()
    expect((result as Record<string, unknown>).streamToolCalls).toBeUndefined()
  })

  it('keeps embedded assistant tool details when tool messages are enabled', () => {
    const message = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'I checked it.' },
        { type: 'toolCall', id: 'tool-1', name: 'terminal' },
      ],
    } as ChatMessage

    expect(stripToolDetailsForDisplay(message, true)).toBe(message)
  })
})
