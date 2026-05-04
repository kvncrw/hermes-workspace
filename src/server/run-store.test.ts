import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

let tempRoot = ''

async function loadModule() {
  vi.resetModules()
  tempRoot = mkdtempSync(join(tmpdir(), 'run-store-test-'))
  vi.doMock('./claude-paths', () => ({
    getHermesRoot: () => tempRoot,
  }))
  return await import('./run-store')
}

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('./claude-paths')
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true })
  tempRoot = ''
})

describe('run-store', () => {
  it('serializes concurrent updates into a valid run file', async () => {
    const mod = await loadModule()
    const sessionKey = 'session-a'
    const runId = 'run-a'

    await mod.createPersistedRun({ sessionKey, runId })
    await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        mod.appendRunText(sessionKey, runId, `[${index}]`),
      ),
    )
    await mod.markRunStatus(sessionKey, runId, 'complete')

    const filePath = join(
      tempRoot,
      'webui-mvp',
      'runs',
      encodeURIComponent(sessionKey),
      `${runId}.json`,
    )
    expect(existsSync(filePath)).toBe(true)
    const raw = readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)

    expect(parsed.status).toBe('complete')
    for (let index = 0; index < 40; index += 1) {
      expect(parsed.assistantText).toContain(`[${index}]`)
    }
    expect(await mod.getActiveRunForSession(sessionKey)).toBeNull()

    const leftovers = readdirSync(join(tempRoot, 'webui-mvp', 'runs', sessionKey))
      .filter((name) => name.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })
})
