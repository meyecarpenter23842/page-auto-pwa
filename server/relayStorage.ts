import { Redis } from '@upstash/redis'
import {
  isRelayCommandRecord,
  isRelayRecord,
  type RelayCommandRecord,
  type RelayRecord
} from './relayProtocol.js'

const RELAY_RECORD_KEY = 'page-auto:relay:record:v1'
const RELAY_HEARTBEAT_KEY = 'page-auto:relay:heartbeat:v1'
const RELAY_COMMAND_KEY = 'page-auto:relay:command:v1'
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

interface RedisCredentials {
  url: string
  token: string
}

let cachedClient: Redis | null = null
let cachedClientKey = ''

function redisCredentials(): RedisCredentials | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)?.trim() ?? ''
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)?.trim() ?? ''
  return url && token ? { url, token } : null
}

function redisClient(): Redis {
  const credentials = redisCredentials()
  if (!credentials) throw new Error('Relay Redis storage is not configured.')
  const key = `${credentials.url}\n${credentials.token}`
  if (!cachedClient || cachedClientKey !== key) {
    cachedClient = new Redis({ url: credentials.url, token: credentials.token })
    cachedClientKey = key
  }
  return cachedClient
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
  if (!isRelayRecord(value)) throw new Error('Redis relay record is invalid.')
  return value
}

function parseRelayCommandRecord(value: unknown): RelayCommandRecord | null {
  if (value === null || value === undefined) return null
  if (!isRelayCommandRecord(value)) throw new Error('Redis relay command record is invalid.')
  return value
}

function parseRelayHeartbeat(value: unknown): RelayHeartbeat | null {
  if (value === null || value === undefined) return null
  if (!isRelayHeartbeat(value)) throw new Error('Redis relay heartbeat is invalid.')
  return value
}

export function relayStorageConfigured(): boolean {
  return redisCredentials() !== null
}

export async function loadRelayRecord(): Promise<RelayRecord | null> {
  return parseRelayRecord(await redisClient().get(RELAY_RECORD_KEY))
}

export async function loadRelaySnapshotState(): Promise<RelaySnapshotState> {
  const values = await redisClient().mget(RELAY_RECORD_KEY, RELAY_HEARTBEAT_KEY) as unknown[]
  return {
    relay: parseRelayRecord(values[0]),
    heartbeat: parseRelayHeartbeat(values[1])
  }
}

export async function saveRelayRecord(record: RelayRecord): Promise<void> {
  await redisClient().mset({
    [RELAY_RECORD_KEY]: record,
    [RELAY_HEARTBEAT_KEY]: { deviceId: record.deviceId, updatedAt: record.updatedAt } satisfies RelayHeartbeat
  })
}

export async function touchRelayHeartbeat(deviceId: string, updatedAt = Date.now()): Promise<void> {
  await redisClient().set(RELAY_HEARTBEAT_KEY, { deviceId, updatedAt } satisfies RelayHeartbeat)
}

export function relayHeartbeatNeedsTouch(heartbeat: RelayHeartbeat | null, deviceId: string, now = Date.now()): boolean {
  return !heartbeat || heartbeat.deviceId !== deviceId || now - heartbeat.updatedAt >= RELAY_HEARTBEAT_TOUCH_INTERVAL_MS
}

export async function loadRelayCommandRecord(): Promise<RelayCommandRecord | null> {
  return parseRelayCommandRecord(await redisClient().get(RELAY_COMMAND_KEY))
}

export async function loadRelayCommandState(): Promise<RelayCommandState> {
  const values = await redisClient().mget(RELAY_RECORD_KEY, RELAY_COMMAND_KEY, RELAY_HEARTBEAT_KEY) as unknown[]
  return {
    relay: parseRelayRecord(values[0]),
    command: parseRelayCommandRecord(values[1]),
    heartbeat: parseRelayHeartbeat(values[2])
  }
}

export async function saveRelayCommandRecord(record: RelayCommandRecord): Promise<void> {
  await redisClient().set(RELAY_COMMAND_KEY, record, { ex: RELAY_COMMAND_STORAGE_TTL_SECONDS })
}
