import { createHash, timingSafeEqual } from 'node:crypto'

export const RELAY_RECORD_VERSION = 1 as const
export const RELAY_MAX_SNAPSHOT_BYTES = 512 * 1024
export const RELAY_RECORD_PATH = 'page-auto/relay/current.json'
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,96}$/
const DEVICE_ID_PATTERN = /^[a-f0-9]{32}$/
const HASH_PATTERN = /^[a-f0-9]{64}$/

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
