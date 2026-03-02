'use client'

/**
 * FallbackBanner — gateway-driven model fallback notification.
 *
 * Listens to the /api/chat-events SSE stream for gateway `fallback` events
 * (phase="fallback"|"fallback_cleared"). Shows a toast when the gateway
 * switches to a fallback model, and another when the primary is restored.
 *
 * Returns null (no DOM) — same pattern as compaction-notifier.tsx.
 */

import { useEffect } from 'react'
import { toast } from '@/components/ui/toast'

export function FallbackBanner() {
  useEffect(() => {
    let es: EventSource | null = null
    let active = true

    function connect() {
      if (!active) return
      es = new EventSource('/api/chat-events')

      es.addEventListener('fallback', (e: MessageEvent) => {
        if (!active) return
        try {
          const data = JSON.parse(e.data) as {
            phase?: string
            selectedModel?: string
            activeModel?: string
            previousModel?: string
            reason?: string
            attempts?: number
            sessionKey?: string
          }

          if (data.phase === 'fallback') {
            const model = data.activeModel ?? data.selectedModel ?? 'fallback model'
            const reason = data.reason ?? 'primary model unavailable'
            toast(`⚠️ Model switched to ${model} — ${reason}`, {
              type: 'warning',
              duration: 30_000,
            })
          } else if (data.phase === 'fallback_cleared') {
            toast('✅ Primary model restored', {
              type: 'success',
              duration: 8_000,
            })
          }
        } catch {
          /* ignore malformed event */
        }
      })

      es.addEventListener('error', () => {
        // SSE error — just close and let it reconnect naturally
        es?.close()
        es = null
      })
    }

    connect()

    return () => {
      active = false
      es?.close()
      es = null
    }
  }, [])

  return null
}
