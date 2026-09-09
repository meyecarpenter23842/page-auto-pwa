import {
  RELAY_COMMAND_DEFAULT_TTL_MS,
  RELAY_COMMAND_MAX_TTL_MS,
  RELAY_COMMAND_RECORD_VERSION,
  RELAY_MAX_COMMAND_BYTES,
  parseRelayCredentials,
  relayTokenMatches,
  type RelayCommandAction,
  type RelayCommandRecord,
  type RelayGroupPostCommand
} from '../../server/relayProtocol.js'
import {
  loadRelayCommandState,
  relayHeartbeatNeedsTouch,
  relayStorageConfigured,
  saveRelayCommandRecord,
  touchRelayHeartbeat,
  type RelayCommandState
} from '../../server/relayStorage.js'

const COMMAND_ID_PATTERN = /^[A-Za-z0-9_-]{16,80}$/
const COMMAND_ACTIONS = ['start', 'pause', 'resume', 'stop'] as const

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

function sameIntent(command: RelayGroupPostCommand, pageTabId: number, action: RelayCommandAction): boolean {
  return command.pageTabId === pageTabId && command.action === action
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
    if (!relayStorageConfigured()) return json({ error: 'relay_storage_not_configured' }, 503)

    const state = await loadRelayCommandState()
    const authorization = authorize(request, state)
    if (authorization instanceof Response) return authorization

    if (request.method === 'GET') {
      const now = Date.now()
      if (relayHeartbeatNeedsTouch(state.heartbeat, authorization.deviceId, now)) {
        await touchRelayHeartbeat(authorization.deviceId, now)
      }
      const record = state.command
      if (!record || record.deviceId !== authorization.deviceId || record.ack) {
        return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store, max-age=0' } })
      }
      return json({ command: record.command })
    }

    const declaredLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > RELAY_MAX_COMMAND_BYTES) return json({ error: 'payload_too_large' }, 413)
    const raw = await request.text()
    if (Buffer.byteLength(raw, 'utf8') > RELAY_MAX_COMMAND_BYTES) return json({ error: 'payload_too_large' }, 413)

    let input: { commandId?: unknown; pageTabId?: unknown; action?: unknown; ttlMs?: unknown }
    try {
      input = JSON.parse(raw) as typeof input
    } catch {
      return json({ error: 'invalid_json' }, 400)
    }

    const commandId = typeof input.commandId === 'string' ? input.commandId.trim() : ''
    const pageTabId = input.pageTabId
    const action = input.action
    const ttlMs = input.ttlMs === undefined ? RELAY_COMMAND_DEFAULT_TTL_MS : input.ttlMs
    if (!COMMAND_ID_PATTERN.test(commandId)
      || typeof pageTabId !== 'number' || !Number.isInteger(pageTabId) || pageTabId <= 0
      || typeof action !== 'string' || !(COMMAND_ACTIONS as readonly string[]).includes(action)
      || typeof ttlMs !== 'number' || !Number.isInteger(ttlMs) || ttlMs < 1_000 || ttlMs > RELAY_COMMAND_MAX_TTL_MS) {
      return json({ error: 'invalid_command' }, 400)
    }

    const typedAction = action as RelayCommandAction
    const now = Date.now()
    const existing = state.command
    if (existing?.deviceId === authorization.deviceId && existing.command.commandId === commandId) {
      if (!sameIntent(existing.command, pageTabId, typedAction)) return json({ error: 'command_conflict' }, 409)
      return json({ command: existing.command, status: existing.ack ? 'completed' : 'pending' }, existing.ack ? 200 : 202)
    }
    if (existing?.deviceId === authorization.deviceId && !existing.ack && existing.command.expiresAt > now) {
      return json({ error: 'command_pending', commandId: existing.command.commandId }, 409)
    }

    const command: RelayGroupPostCommand = {
      schemaVersion: 1,
      target: 'group_post',
      commandId,
      pageTabId,
      action: typedAction,
      issuedAt: now,
      expiresAt: now + ttlMs
    }
    const record: RelayCommandRecord = {
      version: RELAY_COMMAND_RECORD_VERSION,
      deviceId: authorization.deviceId,
      command,
      ack: null,
      createdAt: now,
      updatedAt: now
    }
    await saveRelayCommandRecord(record)
    return json({ command, status: 'pending' }, 202)
  }
}
