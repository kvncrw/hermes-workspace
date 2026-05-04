import { describe, expect, it } from 'vitest'

import { parseOpenAIStream } from './openai-compat-api'

function createStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.close()
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
      },
    },
  )
}

describe('parseOpenAIStream', () => {
  it('passes through ordinary content chunks', async () => {
    const response = createStreamResponse([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ])

    const chunks = []
    for await (const chunk of parseOpenAIStream(response)) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      { type: 'content', text: 'Hello' },
      { type: 'content', text: ' world' },
    ])
  })

  it('parses CRLF-framed chunks emitted by vLLM', async () => {
    const response = createStreamResponse([
      'data: {"choices":[{"delta":{"role":"assistant","content":""}}]}\r\n\r\n',
      'data: {"choices":[{"delta":{"content":"Ok"}}]}\r\n\r\n',
      'data: {"choices":[{"delta":{"content":"!"}}]}\r\n\r\n',
      'data: [DONE]\r\n\r\n',
    ])

    const chunks = []
    for await (const chunk of parseOpenAIStream(response)) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      { type: 'content', text: 'Ok' },
      { type: 'content', text: '!' },
    ])
  })

  it('emits synthetic tool events for Hermes tool progress frames', async () => {
    const response = createStreamResponse([
      'event: hermes.tool.progress\n',
      'data: {"tool":"terminal","emoji":"💻","label":"ls -la"}\n\n',
      'data: [DONE]\n\n',
    ])

    const chunks = []
    for await (const chunk of parseOpenAIStream(response)) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      {
        type: 'tool',
        name: 'terminal',
        label: '💻 ls -la',
      },
    ])
  })

  it('keeps compatibility with legacy claude tool progress frames', async () => {
    const response = createStreamResponse([
      'event: claude.tool.progress\n',
      'data: {"tool":"terminal","emoji":"💻","label":"pwd"}\n\n',
      'data: [DONE]\n\n',
    ])

    const chunks = []
    for await (const chunk of parseOpenAIStream(response)) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      {
        type: 'tool',
        name: 'terminal',
        label: '💻 pwd',
      },
    ])
  })

  it('handles multiple tool events even when frames are split across transport chunks', async () => {
    const response = createStreamResponse([
      'event: hermes.tool.progress\ndata: {"tool":"browser_get_images","emoji":"📖","la',
      'bel":"scan page"}\n\n',
      'event: hermes.tool.progress\ndata: {"tool":"browser_console","emoji":"🔎","label":"inspect DOM"}\n\n',
      'data: {"choices":[{"delta":{"content":"done"}}]}\n\n',
      'data: [DONE]\n\n',
    ])

    const chunks = []
    for await (const chunk of parseOpenAIStream(response)) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      {
        type: 'tool',
        name: 'browser_get_images',
        label: '📖 scan page',
      },
      {
        type: 'tool',
        name: 'browser_console',
        label: '🔎 inspect DOM',
      },
      { type: 'content', text: 'done' },
    ])
  })
})
