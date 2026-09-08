import {
  RELAY_MAX_SNAPSHOT_BYTES,
  RELAY_RECORD_VERSION,
  isRelayBridgeSnapshot,
  parseRelayCredentials,
  relayTokenHash,
  relayTokenMatches,
  type RelayRecord
} from '../../server/relayProtocol.js'
import { loadRelayRecord, relayStorageConfigured, saveRelayRecord } from '../../server/relayStorage.js'

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' }
  })
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
    if (!relayStorageConfigured()) return json({ error: 'relay_storage_not_configured' }, 503)
    const credentials = parseRelayCredentials(request, true)
    if (!credentials?.deviceId) return json({ error: 'unauthorized' }, 401)

    const declaredLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > RELAY_MAX_SNAPSHOT_BYTES) {
      return json({ error: 'payload_too_large' }, 413)
    }
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > RELAY_MAX_SNAPSHOT_BYTES) return json({ error: 'payload_too_large' }, 413)

    let snapshot: unknown
    try {
      snapshot = (JSON.parse(raw) as { snapshot?: unknown }).snapshot
    } catch {
      return json({ error: 'invalid_json' }, 400)
    }
    if (!isRelayBridgeSnapshot(snapshot)) return json({ error: 'invalid_snapshot' }, 400)

    const existing = await loadRelayRecord()
    if (existing && !relayTokenMatches(existing.tokenHash, credentials.token)) return json({ error: 'unauthorized' }, 401)
    if (existing && existing.deviceId !== credentials.deviceId) return json({ error: 'device_mismatch' }, 409)

    const now = Date.now()
    const record: RelayRecord = {
      version: RELAY_RECORD_VERSION,
      deviceId: credentials.deviceId,
      tokenHash: existing?.tokenHash ?? relayTokenHash(credentials.token),
      claimedAt: existing?.claimedAt ?? now,
      updatedAt: now,
      snapshot
    }
    await saveRelayRecord(record)
    return json({ ok: true, claimed: existing === null, updatedAt: now })
  }
}
