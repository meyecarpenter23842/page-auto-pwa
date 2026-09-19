import { getCache } from '@vercel/functions'
import {
  isRelayCommandRecord,
  isRelayRecord,
  type RelayCommandRecord,
  type RelayRecord
} from './relayProtocol.js'

const LEGACY_RELAY_RECORD_KEY = 'page-auto:relay:record:v1'
const LEGACY_RELAY_HEARTBEAT_KEY = 'page-auto:relay:heartbeat:v1'
const LEGACY_RELAY_COMMAND_KEY = 'page-auto:relay:command:v1'
const RELAY_RECORD_KEY_PREFIX = 'page-auto:relay:record:v2:'
const RELAY_HEARTBEAT_KEY_PREFIX = 'page-auto:relay:heartbeat:v2:'
const RELAY_COMMAND_KEY_PREFIX = 'page-auto:relay:command:v2:'
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

function deviceScopedKey(prefix: string, deviceId: string): string {
  return `${prefix}${deviceId}`
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

async function loadRecordForDevice(cache: ReturnType<typeof getCache>, deviceId: string): Promise<RelayRecord | null> {
  const scoped = parseRelayRecord(await cache.get(deviceScopedKey(RELAY_RECORD_KEY_PREFIX, deviceId)))
  if (scoped) return scoped
  const legacy = parseRelayRecord(await cache.get(LEGACY_RELAY_RECORD_KEY))
  return legacy?.deviceId === deviceId ? legacy : null
}

async function loadHeartbeatForDevice(cache: ReturnType<typeof getCache>, deviceId: string): Promise<RelayHeartbeat | null> {
  const scoped = parseRelayHeartbeat(await cache.get(deviceScopedKey(RELAY_HEARTBEAT_KEY_PREFIX, deviceId)))
  if (scoped) return scoped
  const legacy = parseRelayHeartbeat(await cache.get(LEGACY_RELAY_HEARTBEAT_KEY))
  return legacy?.deviceId === deviceId ? legacy : null
}

async function loadCommandForDevice(cache: ReturnType<typeof getCache>, deviceId: string): Promise<RelayCommandRecord | null> {
  const scoped = parseRelayCommandRecord(await cache.get(deviceScopedKey(RELAY_COMMAND_KEY_PREFIX, deviceId)))
  if (scoped) return scoped
  const legacy = parseRelayCommandRecord(await cache.get(LEGACY_RELAY_COMMAND_KEY))
  return legacy?.deviceId === deviceId ? legacy : null
}

export async function loadRelayRecord(deviceId: string): Promise<RelayRecord | null> {
  return loadRecordForDevice(getCache(), deviceId)
}

export async function loadRelaySnapshotState(deviceId: string): Promise<RelaySnapshotState> {
  const cache = getCache()
  const [relay, heartbeat] = await Promise.all([
    loadRecordForDevice(cache, deviceId),
    loadHeartbeatForDevice(cache, deviceId)
  ])
  return { relay, heartbeat }
}

export async function saveRelayRecord(record: RelayRecord): Promise<void> {
  const cache = getCache()
  await Promise.all([
    cache.set(deviceScopedKey(RELAY_RECORD_KEY_PREFIX, record.deviceId), record, { ttl: RELAY_RECORD_STORAGE_TTL_SECONDS }),
    cache.set(
      deviceScopedKey(RELAY_HEARTBEAT_KEY_PREFIX, record.deviceId),
      { deviceId: record.deviceId, updatedAt: record.updatedAt } satisfies RelayHeartbeat,
      { ttl: RELAY_HEARTBEAT_STORAGE_TTL_SECONDS }
    )
  ])
}

export async function touchRelayHeartbeat(deviceId: string, updatedAt = Date.now()): Promise<void> {
  await getCache().set(
    deviceScopedKey(RELAY_HEARTBEAT_KEY_PREFIX, deviceId),
    { deviceId, updatedAt } satisfies RelayHeartbeat,
    { ttl: RELAY_HEARTBEAT_STORAGE_TTL_SECONDS }
  )
}

export function relayHeartbeatNeedsTouch(heartbeat: RelayHeartbeat | null, deviceId: string, now = Date.now()): boolean {
  return !heartbeat || heartbeat.deviceId !== deviceId || now - heartbeat.updatedAt >= RELAY_HEARTBEAT_TOUCH_INTERVAL_MS
}

export async function loadRelayCommandRecord(deviceId: string): Promise<RelayCommandRecord | null> {
  return loadCommandForDevice(getCache(), deviceId)
}

export async function loadRelayCommandState(deviceId: string): Promise<RelayCommandState> {
  const cache = getCache()
  const [relay, command, heartbeat] = await Promise.all([
    loadRecordForDevice(cache, deviceId),
    loadCommandForDevice(cache, deviceId),
    loadHeartbeatForDevice(cache, deviceId)
  ])
  return { relay, command, heartbeat }
}

export async function saveRelayCommandRecord(record: RelayCommandRecord): Promise<void> {
  await getCache().set(
    deviceScopedKey(RELAY_COMMAND_KEY_PREFIX, record.deviceId),
    record,
    { ttl: RELAY_COMMAND_STORAGE_TTL_SECONDS }
  )
}
