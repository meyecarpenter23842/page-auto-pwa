import { createHash, timingSafeEqual } from 'node:crypto'

export const RELAY_RECORD_VERSION = 1 as const
export const RELAY_COMMAND_RECORD_VERSION = 1 as const
export const RELAY_MAX_SNAPSHOT_BYTES = 512 * 1024
export const RELAY_MAX_COMMAND_BYTES = 8 * 1024
export const RELAY_RECORD_PATH = 'page-auto/relay/current.json'
export const RELAY_COMMAND_RECORD_PATH = 'page-auto/relay/command.json'
export const RELAY_COMMAND_DEFAULT_TTL_MS = 30_000
export const RELAY_COMMAND_MAX_TTL_MS = 60_000
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,96}$/
const DEVICE_ID_PATTERN = /^[a-f0-9]{32}$/
const HASH_PATTERN = /^[a-f0-9]{64}$/
const COMMAND_ID_PATTERN = /^[A-Za-z0-9_-]{16,80}$/
const COMMAND_ACTIONS = ['start', 'pause', 'resume', 'stop'] as const
const RUNTIME_STATUSES = ['idle', 'starting', 'running', 'paused', 'waiting_window', 'stopping', 'stopped', 'completed', 'error'] as const
const RESULT_CODES = ['ok', 'invalid_command', 'expired', 'page_not_found', 'invalid_state', 'command_conflict', 'runtime_error'] as const

export type RelayCommandAction = (typeof COMMAND_ACTIONS)[number]
export type RelayRuntimeStatus = (typeof RUNTIME_STATUSES)[number]
export type RelayCommandResultCode = (typeof RESULT_CODES)[number]

export interface RelayBridgeSnapshot {
  schemaVersion: 1
  generatedAt: number
  staleAfterMs: number
  summary: unknown
  pages: unknown[]
  recentLogs: unknown[]
}

export interface RelayRecord {
  version: typeof RELAY_RECORD_VERSION
  deviceId: string
  tokenHash: string
  claimedAt: number
  updatedAt: number
  snapshot: RelayBridgeSnapshot
}

export interface RelayGroupPostCommand {
  schemaVersion: 1
  target: 'group_post'
  commandId: string
  pageTabId: number
  action: RelayCommandAction
  issuedAt: number
  expiresAt: number
}

export interface RelayGroupPostCommandResult {
  schemaVersion: 1
  commandId: string
  target: 'group_post'
  pageTabId: number
  action: RelayCommandAction
  ok: boolean
  code: RelayCommandResultCode
  message: string | null
  handledAt: number
  fromStatus: RelayRuntimeStatus | null
  runtimeStatus: RelayRuntimeStatus | null
  runId: number | null
}

export interface RelayGroupPostCommandAck {
  result: RelayGroupPostCommandResult
  snapshot: RelayBridgeSnapshot
}

export interface RelayCommandRecord {
  version: typeof RELAY_COMMAND_RECORD_VERSION
  deviceId: string
  command: RelayGroupPostCommand
  ack: RelayGroupPostCommandAck | null
  createdAt: number
  updatedAt: number
}

export function parseRelayCredentials(request: Request, requireDeviceId = true): { deviceId: string | null; token: string } | null {
  const authorization = request.headers.get('authorization')?.trim() ?? ''
  if (!authorization.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length).trim()
  if (!TOKEN_PATTERN.test(token)) return null
  const deviceId = request.headers.get('x-page-auto-device-id')?.trim().toLowerCase() || null
  if (requireDeviceId && (!deviceId || !DEVICE_ID_PATTERN.test(deviceId))) return null
  if (deviceId && !DEVICE_ID_PATTERN.test(deviceId)) return null
  return { deviceId, token }
}

export function relayTokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function relayTokenMatches(expectedHash: string, token: string): boolean {
  if (!HASH_PATTERN.test(expectedHash)) return false
  const expected = Buffer.from(expectedHash, 'hex')
  const actual = Buffer.from(relayTokenHash(token), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function isRelayBridgeSnapshot(value: unknown): value is RelayBridgeSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RelayBridgeSnapshot>
  return candidate.schemaVersion === 1
    && typeof candidate.generatedAt === 'number'
    && Number.isFinite(candidate.generatedAt)
    && typeof candidate.staleAfterMs === 'number'
    && candidate.staleAfterMs >= 1_000
    && candidate.staleAfterMs <= 5 * 60_000
    && candidate.summary !== null
    && typeof candidate.summary === 'object'
    && Array.isArray(candidate.pages)
    && Array.isArray(candidate.recentLogs)
}

export function isRelayRecord(value: unknown): value is RelayRecord {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RelayRecord>
  return candidate.version === RELAY_RECORD_VERSION
    && typeof candidate.deviceId === 'string'
    && DEVICE_ID_PATTERN.test(candidate.deviceId)
    && typeof candidate.tokenHash === 'string'
    && HASH_PATTERN.test(candidate.tokenHash)
    && typeof candidate.claimedAt === 'number'
    && Number.isFinite(candidate.claimedAt)
    && typeof candidate.updatedAt === 'number'
    && Number.isFinite(candidate.updatedAt)
    && isRelayBridgeSnapshot(candidate.snapshot)
}

export function isRelayGroupPostCommand(value: unknown): value is RelayGroupPostCommand {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RelayGroupPostCommand>
  return candidate.schemaVersion === 1
    && candidate.target === 'group_post'
    && typeof candidate.commandId === 'string'
    && COMMAND_ID_PATTERN.test(candidate.commandId)
    && typeof candidate.pageTabId === 'number'
    && Number.isInteger(candidate.pageTabId)
    && candidate.pageTabId > 0
    && typeof candidate.action === 'string'
    && (COMMAND_ACTIONS as readonly string[]).includes(candidate.action)
    && typeof candidate.issuedAt === 'number'
    && Number.isFinite(candidate.issuedAt)
    && typeof candidate.expiresAt === 'number'
    && Number.isFinite(candidate.expiresAt)
    && candidate.expiresAt > candidate.issuedAt
    && candidate.expiresAt - candidate.issuedAt <= RELAY_COMMAND_MAX_TTL_MS
}

export function isRelayGroupPostCommandResult(value: unknown): value is RelayGroupPostCommandResult {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RelayGroupPostCommandResult>
  return candidate.schemaVersion === 1
    && candidate.target === 'group_post'
    && typeof candidate.commandId === 'string'
    && COMMAND_ID_PATTERN.test(candidate.commandId)
    && typeof candidate.pageTabId === 'number'
    && Number.isInteger(candidate.pageTabId)
    && candidate.pageTabId > 0
    && typeof candidate.action === 'string'
    && (COMMAND_ACTIONS as readonly string[]).includes(candidate.action)
    && typeof candidate.ok === 'boolean'
    && typeof candidate.code === 'string'
    && (RESULT_CODES as readonly string[]).includes(candidate.code)
    && (candidate.message === null || typeof candidate.message === 'string')
    && typeof candidate.handledAt === 'number'
    && Number.isFinite(candidate.handledAt)
    && (candidate.fromStatus === null || (typeof candidate.fromStatus === 'string' && (RUNTIME_STATUSES as readonly string[]).includes(candidate.fromStatus)))
    && (candidate.runtimeStatus === null || (typeof candidate.runtimeStatus === 'string' && (RUNTIME_STATUSES as readonly string[]).includes(candidate.runtimeStatus)))
    && (candidate.runId === null || (typeof candidate.runId === 'number' && Number.isInteger(candidate.runId) && candidate.runId > 0))
}

export function isRelayGroupPostCommandAck(value: unknown): value is RelayGroupPostCommandAck {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RelayGroupPostCommandAck>
  return isRelayGroupPostCommandResult(candidate.result) && isRelayBridgeSnapshot(candidate.snapshot)
}

export function isRelayCommandRecord(value: unknown): value is RelayCommandRecord {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RelayCommandRecord>
  return candidate.version === RELAY_COMMAND_RECORD_VERSION
    && typeof candidate.deviceId === 'string'
    && DEVICE_ID_PATTERN.test(candidate.deviceId)
    && isRelayGroupPostCommand(candidate.command)
    && (candidate.ack === null || isRelayGroupPostCommandAck(candidate.ack))
    && typeof candidate.createdAt === 'number'
    && Number.isFinite(candidate.createdAt)
    && typeof candidate.updatedAt === 'number'
    && Number.isFinite(candidate.updatedAt)
}
