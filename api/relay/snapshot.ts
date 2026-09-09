import { parseRelayCredentials, relayTokenMatches } from '../../server/relayProtocol.js'
import {
  RELAY_HEARTBEAT_STALE_AFTER_MS,
  loadRelaySnapshotState,
  relayStorageConfigured
} from '../../server/relayStorage.js'

function json(payload: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      ...extraHeaders
    }
  })
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405)
    if (!relayStorageConfigured()) return json({ error: 'relay_storage_not_configured' }, 503)
    const credentials = parseRelayCredentials(request, true)
    if (!credentials?.deviceId) return json({ error: 'unauthorized' }, 401)

    const { relay, heartbeat } = await loadRelaySnapshotState()
    if (!relay) return json({ error: 'relay_unclaimed' }, 404)
    if (!relayTokenMatches(relay.tokenHash, credentials.token) || relay.deviceId !== credentials.deviceId) {
      return json({ error: 'unauthorized' }, 401)
    }

    const heartbeatAt = heartbeat?.deviceId === relay.deviceId ? heartbeat.updatedAt : relay.updatedAt
    const snapshot = {
      ...relay.snapshot,
      generatedAt: Math.max(relay.snapshot.generatedAt, heartbeatAt),
      staleAfterMs: Math.max(relay.snapshot.staleAfterMs, RELAY_HEARTBEAT_STALE_AFTER_MS)
    }
    return json(snapshot, 200, {
      'X-Page-Auto-Relay-Updated-At': String(relay.updatedAt),
      'X-Page-Auto-Relay-Heartbeat-At': String(heartbeatAt)
    })
  }
}
