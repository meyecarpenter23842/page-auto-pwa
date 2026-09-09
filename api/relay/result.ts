import {
  RELAY_MAX_SNAPSHOT_BYTES,
  isRelayGroupPostCommandAck,
  parseRelayCredentials,
  relayTokenMatches,
  type RelayGroupPostCommandAck
} from '../../server/relayProtocol.js'
import {
  loadRelayCommandState,
  relayStorageConfigured,
  saveRelayCommandRecord,
  saveRelayRecord,
  type RelayCommandState
} from '../../server/relayStorage.js'

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, { status, headers: { 'Cache-Control': 'no-store, max-age=0' } })
}

function authorize(request: Request, state: RelayCommandState): { deviceId: string } | Response {
  const credentials = parseRelayCredentials(request, true)
  if (!credentials?.deviceId) return json({ error: 'unauthorized' }, 401)
  if (!state.relay) return json({ error: 'relay_unclaimed' }, 404)
  if (state.relay.deviceId !== credentials.deviceId || !relayTokenMatches(state.relay.tokenHash, credentials.token)) {
    return json({ error: 'unauthorized' }, 401)
  }
  return { deviceId: credentials.deviceId }
}

function matchesCommand(ack: RelayGroupPostCommandAck, record: NonNullable<RelayCommandState['command']>): boolean {
  const { command } = record
  const { result } = ack
  return result.commandId === command.commandId
    && result.pageTabId === command.pageTabId
    && result.action === command.action
    && result.target === command.target
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
    if (!relayStorageConfigured()) return json({ error: 'relay_storage_not_configured' }, 503)

    const state = await loadRelayCommandState()
    const authorization = authorize(request, state)
    if (authorization instanceof Response) return authorization
    const record = state.command
    if (!record || record.deviceId !== authorization.deviceId) return json({ error: 'command_not_found' }, 404)

    if (request.method === 'GET') {
      const commandId = new URL(request.url).searchParams.get('commandId')?.trim() ?? ''
      if (!commandId || commandId !== record.command.commandId) return json({ error: 'command_not_found' }, 404)
      if (!record.ack) return json({ status: 'pending' }, 202)
      return json(record.ack)
    }

    const declaredLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > RELAY_MAX_SNAPSHOT_BYTES) return json({ error: 'payload_too_large' }, 413)
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > RELAY_MAX_SNAPSHOT_BYTES) return json({ error: 'payload_too_large' }, 413)
    let ack: unknown
    try {
      ack = JSON.parse(raw) as unknown
    } catch {
      return json({ error: 'invalid_json' }, 400)
    }
    if (!isRelayGroupPostCommandAck(ack) || !matchesCommand(ack, record)) return json({ error: 'invalid_result' }, 400)

    if (record.ack) {
      if (JSON.stringify(record.ack.result) !== JSON.stringify(ack.result)) return json({ error: 'result_conflict' }, 409)
      return json({ ok: true, duplicate: true, updatedAt: record.updatedAt })
    }

    const now = Date.now()
    await Promise.all([
      saveRelayCommandRecord({ ...record, ack, updatedAt: now }),
      state.relay ? saveRelayRecord({ ...state.relay, snapshot: ack.snapshot, updatedAt: now }) : Promise.resolve()
    ])
    return json({ ok: true, duplicate: false, updatedAt: now })
  }
}
