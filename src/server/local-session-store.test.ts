import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

let tempRoot = ''

async function loadModule() {
  vi.resetModules()
  vi.doMock('./claude-paths', () => ({
    getHermesRoot: () => tempRoot,
  }))
  return await import('./local-session-store')
}

afterEach(() => {
  vi.resetModules()
  vi.doUnmock('./claude-paths')
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true })
  tempRoot = ''
})

describe('local-session-store', () => {
  it('persists local sessions under the Hermes root', async () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'local-session-store-test-'))
    const mod = await loadModule()

    mod.ensureLocalSession('session-a', 'local/model')

    const sessionFile = join(tempRoot, 'webui-mvp', 'local-sessions.json')
    expect(existsSync(sessionFile)).toBe(true)

    const reloaded = await loadModule()
    expect(reloaded.getLocalSession('session-a')).toMatchObject({
      id: 'session-a',
      model: 'local/model',
    })
  })
})
