import { parseRelayCredentials, relayTokenMatches } from '../../server/relayProtocol.js'
import { loadRelayRecord, relayStorageConfigured } from '../../server/relayStorage.js'

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

    const record = await loadRelayRecord()
    if (!record) return json({ error: 'relay_unclaimed' }, 404)
    if (!relayTokenMatches(record.tokenHash, credentials.token) || record.deviceId !== credentials.deviceId) {
      return json({ error: 'unauthorized' }, 401)
    }

    return json(record.snapshot, 200, {
      'X-Page-Auto-Relay-Updated-At': String(record.updatedAt)
    })
  }
}
