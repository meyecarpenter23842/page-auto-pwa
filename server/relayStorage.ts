import { getCache } from '@vercel/functions'
import {
  isRelayCommandRecord,
  isRelayRecord,
  type RelayCommandRecord,
  type RelayRecord
} from './relayProtocol.js'

const RELAY_RECORD_KEY = 'page-auto:relay:record:v1'
const RELAY_HEARTBEAT_KEY = 'page-auto:relay:heartbeat:v1'
const RELAY_COMMAND_KEY = 'page-auto:relay:command:v1'
const RELAY_RECORD_STORAGE_TTL_SECONDS = 30 * 24 * 60 * 60
const RELAY_HEARTBEAT_STORAGE_TTL_SECONDS = 5 * 60
const RELAY_COMMAND_STORAGE_TTL_SECONDS = 5 * 60
export const RELAY_HEARTBEAT_TOUCH_INTERVAL_MS = 25_000
export const RELAY_HEARTBEAT_STALE_AFTER_MS = 60_000

export interface RelayHeartbeat {
  deviceId: string
  updatedAt: number
}

export interface RelaySnapshotState {
  relay: RelayRecord | null
  heartbeat: RelayHeartbeat | null
}

export interface RelayCommandState extends RelaySnapshotState {
  command: RelayCommandRecord | null
}

function isRelayHeartbeat(value: unknown): value is RelayHeartbeat {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RelayHeartbeat>
  return typeof candidate.deviceId === 'string'
    && /^[a-f0-9]{32}$/.test(candidate.deviceId)
    && typeof candidate.updatedAt === 'number'
    && Number.isFinite(candidate.updatedAt)
}

function parseRelayRecord(value: unknown): RelayRecord | null {
  if (value === null || value === undefined) return null
  if (!isRelayRecord(value)) throw new Error('Runtime Cache relay record is invalid.')
  return value
}

function parseRelayCommandRecord(value: unknown): RelayCommandRecord | null {
  if (value === null || value === undefined) return null
  if (!isRelayCommandRecord(value)) throw new Error('Runtime Cache relay command record is invalid.')
  return value
}

function parseRelayHeartbeat(value: unknown): RelayHeartbeat | null {
  if (value === null || value === undefined) return null
  if (!isRelayHeartbeat(value)) throw new Error('Runtime Cache relay heartbeat is invalid.')
  return value
}

export function relayStorageConfigured(): boolean {
  return true
}

export async function loadRelayRecord(): Promise<RelayRecord | null> {
  return parseRelayRecord(await getCache().get(RELAY_RECORD_KEY))
}

export async function loadRelaySnapshotState(): Promise<RelaySnapshotState> {
  const cache = getCache()
  const [relay, heartbeat] = await Promise.all([
    cache.get(RELAY_RECORD_KEY),
    cache.get(RELAY_HEARTBEAT_KEY)
  ])
  return {
    relay: parseRelayRecord(relay),
    heartbeat: parseRelayHeartbeat(heartbeat)
  }
}

export async function saveRelayRecord(record: RelayRecord): Promise<void> {
  const cache = getCache()
  await Promise.all([
    cache.set(RELAY_RECORD_KEY, record, { ttl: RELAY_RECORD_STORAGE_TTL_SECONDS }),
    cache.set(
      RELAY_HEARTBEAT_KEY,
      { deviceId: record.deviceId, updatedAt: record.updatedAt } satisfies RelayHeartbeat,
      { ttl: RELAY_HEARTBEAT_STORAGE_TTL_SECONDS }
    )
  ])
}

export async function touchRelayHeartbeat(deviceId: string, updatedAt = Date.now()): Promise<void> {
  await getCache().set(
    RELAY_HEARTBEAT_KEY,
    { deviceId, updatedAt } satisfies RelayHeartbeat,
    { ttl: RELAY_HEARTBEAT_STORAGE_TTL_SECONDS }
  )
}

export function relayHeartbeatNeedsTouch(heartbeat: RelayHeartbeat | null, deviceId: string, now = Date.now()): boolean {
  return !heartbeat || heartbeat.deviceId !== deviceId || now - heartbeat.updatedAt >= RELAY_HEARTBEAT_TOUCH_INTERVAL_MS
}

export async function loadRelayCommandRecord(): Promise<RelayCommandRecord | null> {
  return parseRelayCommandRecord(await getCache().get(RELAY_COMMAND_KEY))
}

export async function loadRelayCommandState(): Promise<RelayCommandState> {
  const cache = getCache()
  const [relay, command, heartbeat] = await Promise.all([
    cache.get(RELAY_RECORD_KEY),
    cache.get(RELAY_COMMAND_KEY),
    cache.get(RELAY_HEARTBEAT_KEY)
  ])
  return {
    relay: parseRelayRecord(relay),
    command: parseRelayCommandRecord(command),
    heartbeat: parseRelayHeartbeat(heartbeat)
  }
}

export async function saveRelayCommandRecord(record: RelayCommandRecord): Promise<void> {
  await getCache().set(RELAY_COMMAND_KEY, record, { ttl: RELAY_COMMAND_STORAGE_TTL_SECONDS })
}
