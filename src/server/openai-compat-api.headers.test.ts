import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }
let tempRoot = ''

afterEach(() => {
  vi.resetModules()
  vi.restoreAllMocks()
  process.env = { ...originalEnv }
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true })
  tempRoot = ''
})

describe('openaiChat headers', () => {
  it('sends Hermes session continuity headers when authenticated', async () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'openai-headers-test-'))
    process.env = {
      ...originalEnv,
      HERMES_HOME: tempRoot,
      HERMES_API_URL: 'http://hermes-agent.test',
      HERMES_API_TOKEN: 'test-token',
    }

    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { openaiChat } = await import('./openai-compat-api')
    await openaiChat([{ role: 'user', content: 'hello' }], {
      model: 'model-a',
      sessionId: 'session-a',
    })

    const chatCall = fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith('/v1/chat/completions'))
      .at(-1)
    expect(chatCall).toBeTruthy()
    const [, init] = chatCall ?? []
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer test-token',
      'X-Hermes-Session-Id': 'session-a',
      'X-Claude-Session-Id': 'session-a',
    })
  })
})
