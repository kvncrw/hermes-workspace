import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  SESSIONS_API_UNAVAILABLE_MESSAGE,
  ensureGatewayProbed,
  getGatewayCapabilities,
  getMessages,
  toChatMessage,
} from '../../../server/claude-api'
import {
  getLocalMessages,
  getLocalSession,
} from '../../../server/local-session-store'

export const Route = createFileRoute('/api/sessions/$sessionKey/messages')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const sessionKey = params.sessionKey?.trim()
        if (!sessionKey) {
          return json(
            { ok: false, error: 'sessionKey required' },
            { status: 400 },
          )
        }

        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') || '200')

        const localSession = getLocalSession(sessionKey)
        if (localSession) {
          const localMessages = getLocalMessages(sessionKey)
          const boundedMessages =
            limit > 0 ? localMessages.slice(-limit) : localMessages
          return json({
            ok: true,
            sessionKey,
            source: 'local',
            messages: boundedMessages.map((message, index) => ({
              id: message.id,
              role: message.role,
              content: [{ type: 'text', text: message.content }],
              timestamp: message.timestamp,
              historyIndex: index,
            })),
          })
        }

        await ensureGatewayProbed()
        if (!getGatewayCapabilities().sessions) {
          return json(
            {
              ok: false,
              messages: [],
              error: SESSIONS_API_UNAVAILABLE_MESSAGE,
            },
            { status: 503 },
          )
        }

        try {
          const rows = await getMessages(sessionKey)
          const boundedMessages = limit > 0 ? rows.slice(-limit) : rows
          return json({
            ok: true,
            sessionKey,
            source: 'gateway',
            messages: boundedMessages.map((message, index) =>
              toChatMessage(message, { historyIndex: index }),
            ),
          })
        } catch (err) {
          return json(
            {
              ok: false,
              messages: [],
              sessionKey,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
