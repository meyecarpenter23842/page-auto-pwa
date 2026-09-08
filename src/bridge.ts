import type { RelayPairing } from './pairing'

export type RuntimeStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'paused'
  | 'waiting_window'
  | 'stopping'
  | 'stopped'
  | 'completed'
  | 'error'

export type AccountRuntimeStatus = 'not_run' | 'completed_turn' | 'running' | 'error' | 'waiting'
export type WindowRuntimeStatus = 'upcoming' | 'running' | 'closed_account_cycle' | 'closed_time_remaining_accounts'
export type GroupPostCommandAction = 'start' | 'pause' | 'resume' | 'stop'
export type GroupPostCommandResultCode = 'ok' | 'invalid_command' | 'expired' | 'page_not_found' | 'invalid_state' | 'command_conflict' | 'runtime_error'

export interface BridgeAccount {
  accountId: number
  uid: string
  name: string | null
  status: AccountRuntimeStatus
  message: string | null
}

export interface BridgeSchedule {
  dayOfWeek: number
  startMinute: number
  endMinute: number
  status: WindowRuntimeStatus | null
  currentAccountId: number | null
  groupRemaining: number | null
}

export interface BridgeCurrentPost {
  groupUid: string
  contentPreview: string
  contentLength: number
  imageCount: number
  postIndex: number
  variantIndex: number
}

export interface BridgePage {
  pageTabId: number
  name: string
  pageUid: string
  configuredStatus: string
  runtimeStatus: RuntimeStatus
  runId: number | null
  runStatus: string | null
  message: string | null
  accountCount: number
  groupCount: number
  accountConcurrency: number
  postsPerAccount: number
  currentAccountId: number | null
  currentGroupUid: string | null
  nextActionAt: number | null
  cycle: number
  slotsCompletedThisTurn: number
  targetSlotsThisTurn: number
  progress: {
    total: number
    success: number
    failed: number
    skipped: number
    remaining: number
    percent: number
  } | null
  today: { success: number; failed: number }
  accounts: BridgeAccount[]
  schedules: BridgeSchedule[]
  currentPost: BridgeCurrentPost | null
}

export interface BridgeLog {
  id: number
  timestamp: number
  pageTabId: number
  accountId: number | null
  pageUid: string | null
  groupUid: string
  action: string
  result: string
  errorCode: string | null
  errorMessage: string | null
  publishedUrl: string | null
}

export interface BridgeSnapshot {
  schemaVersion: 1
  generatedAt: number
  staleAfterMs: number
  summary: {
    totalPages: number
    activePages: number
    pausedPages: number
    successToday: number
    failedToday: number
    nextActionAt: number | null
  }
  pages: BridgePage[]
  recentLogs: BridgeLog[]
}

export interface GroupPostCommandResult {
  schemaVersion: 1
  commandId: string
  target: 'group_post'
  pageTabId: number
  action: GroupPostCommandAction
  ok: boolean
  code: GroupPostCommandResultCode
  message: string | null
  handledAt: number
  fromStatus: RuntimeStatus | null
  runtimeStatus: RuntimeStatus | null
  runId: number | null
}

export interface GroupPostCommandAck {
  result: GroupPostCommandResult
  snapshot: BridgeSnapshot
}

const DEFAULT_SNAPSHOT_ENDPOINT = '/api/relay/snapshot'
const DEFAULT_COMMAND_ENDPOINT = '/api/relay/command'
const DEFAULT_RESULT_ENDPOINT = '/api/relay/result'
const COMMAND_TTL_MS = 30_000
const COMMAND_WAIT_MS = 35_000
const COMMAND_POLL_MS = 750
const COMMAND_ID_PATTERN = /^[A-Za-z0-9_-]{16,80}$/
const COMMAND_ACTIONS = ['start', 'pause', 'resume', 'stop'] as const
const RESULT_CODES = ['ok', 'invalid_command', 'expired', 'page_not_found', 'invalid_state', 'command_conflict', 'runtime_error'] as const
const RUNTIME_STATUSES: RuntimeStatus[] = ['idle', 'starting', 'running', 'paused', 'waiting_window', 'stopping', 'stopped', 'completed', 'error']

let lastGoodSnapshot: { cacheKey: string; snapshot: BridgeSnapshot } | null = null

export class PairingRequiredError extends Error {
  constructor() {
    super('PWA chưa được ghép với PAGE-AUTO trên máy tính.')
    this.name = 'PairingRequiredError'
  }
}

export class BridgeAuthError extends Error {
  constructor() {
    super('Mã ghép PWA không còn hợp lệ.')
    this.name = 'BridgeAuthError'
  }
}

export class RemoteControlUnavailableError extends Error {
  constructor(message = 'Remote Control chưa khả dụng cho nguồn snapshot tùy chỉnh.') {
    super(message)
    this.name = 'RemoteControlUnavailableError'
  }
}

function snapshotEndpoint(): { url: string; requiresPairing: boolean } {
  const configured = import.meta.env.VITE_PAGE_AUTO_SNAPSHOT_URL?.trim()
  return configured
    ? { url: configured, requiresPairing: false }
    : { url: DEFAULT_SNAPSHOT_ENDPOINT, requiresPairing: true }
}

function relayHeaders(pairing: RelayPairing): Record<string, string> {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${pairing.token}`,
    'Content-Type': 'application/json',
    'X-Page-Auto-Device-Id': pairing.deviceId
  }
}

function freshCachedSnapshot(cacheKey: string): BridgeSnapshot | null {
  if (!lastGoodSnapshot || lastGoodSnapshot.cacheKey !== cacheKey) return null
  return isSnapshotFresh(lastGoodSnapshot.snapshot) ? lastGoodSnapshot.snapshot : null
}

function rememberSnapshot(cacheKey: string, snapshot: BridgeSnapshot): BridgeSnapshot {
  const cached = freshCachedSnapshot(cacheKey)
  if (cached && cached.generatedAt > snapshot.generatedAt) return cached
  lastGoodSnapshot = { cacheKey, snapshot }
  return snapshot
}

function clearCachedSnapshot(cacheKey: string): void {
  if (lastGoodSnapshot?.cacheKey === cacheKey) lastGoodSnapshot = null
}

function isBridgeSnapshot(value: unknown): value is BridgeSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<BridgeSnapshot>
  return candidate.schemaVersion === 1
    && typeof candidate.generatedAt === 'number'
    && Number.isFinite(candidate.generatedAt)
    && typeof candidate.staleAfterMs === 'number'
    && Array.isArray(candidate.pages)
    && Array.isArray(candidate.recentLogs)
}

function isGroupPostCommandResult(value: unknown): value is GroupPostCommandResult {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<GroupPostCommandResult>
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
    && (candidate.fromStatus === null || (typeof candidate.fromStatus === 'string' && RUNTIME_STATUSES.includes(candidate.fromStatus as RuntimeStatus)))
    && (candidate.runtimeStatus === null || (typeof candidate.runtimeStatus === 'string' && RUNTIME_STATUSES.includes(candidate.runtimeStatus as RuntimeStatus)))
    && (candidate.runId === null || (typeof candidate.runId === 'number' && Number.isInteger(candidate.runId) && candidate.runId > 0))
}

function isGroupPostCommandAck(value: unknown): value is GroupPostCommandAck {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<GroupPostCommandAck>
  return isGroupPostCommandResult(candidate.result) && isBridgeSnapshot(candidate.snapshot)
}

export function acceptBridgeSnapshot(pairing: RelayPairing, snapshot: BridgeSnapshot): BridgeSnapshot {
  return rememberSnapshot(`device:${pairing.deviceId}`, snapshot)
}

export async function fetchBridgeSnapshot(pairing: RelayPairing | null, signal?: AbortSignal): Promise<BridgeSnapshot> {
  const endpoint = snapshotEndpoint()
  if (endpoint.requiresPairing && !pairing) throw new PairingRequiredError()

  const cacheKey = endpoint.requiresPairing ? `device:${pairing?.deviceId ?? ''}` : `url:${endpoint.url}`
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (endpoint.requiresPairing && pairing) {
    headers.Authorization = `Bearer ${pairing.token}`
    headers['X-Page-Auto-Device-Id'] = pairing.deviceId
  }

  try {
    const response = await fetch(endpoint.url, { method: 'GET', cache: 'no-store', headers, signal })
    if (response.status === 401) {
      clearCachedSnapshot(cacheKey)
      throw new BridgeAuthError()
    }
    if (!response.ok) throw new Error(`Bridge HTTP ${response.status}`)
    const payload = await response.json() as unknown
    if (!isBridgeSnapshot(payload)) throw new Error('Bridge snapshot không hợp lệ.')

    if (isSnapshotFresh(payload)) return rememberSnapshot(cacheKey, payload)
    return freshCachedSnapshot(cacheKey) ?? payload
  } catch (error) {
    if (error instanceof BridgeAuthError || signal?.aborted) throw error
    const cached = freshCachedSnapshot(cacheKey)
    if (cached) return cached
    throw error
  }
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = window.setTimeout(resolve, milliseconds)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

export async function sendGroupPostCommand(
  pairing: RelayPairing | null,
  pageTabId: number,
  action: GroupPostCommandAction,
  signal?: AbortSignal
): Promise<GroupPostCommandAck> {
  const endpoint = snapshotEndpoint()
  if (!endpoint.requiresPairing) throw new RemoteControlUnavailableError()
  if (!pairing) throw new PairingRequiredError()

  const commandId = crypto.randomUUID()
  const headers = relayHeaders(pairing)
  const enqueue = await fetch(DEFAULT_COMMAND_ENDPOINT, {
    method: 'POST',
    cache: 'no-store',
    headers,
    signal,
    body: JSON.stringify({ commandId, pageTabId, action, ttlMs: COMMAND_TTL_MS })
  })
  if (enqueue.status === 401) throw new BridgeAuthError()
  if (!enqueue.ok && enqueue.status !== 202) {
    const payload = await enqueue.json().catch(() => null) as { error?: string } | null
    if (payload?.error === 'command_pending') throw new Error('Một lệnh Remote Control khác đang chờ desktop xử lý.')
    throw new Error(`Remote command HTTP ${enqueue.status}`)
  }

  const deadline = Date.now() + COMMAND_WAIT_MS
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const response = await fetch(`${DEFAULT_RESULT_ENDPOINT}?commandId=${encodeURIComponent(commandId)}`, {
      method: 'GET',
      cache: 'no-store',
      headers,
      signal
    })
    if (response.status === 401) throw new BridgeAuthError()
    if (response.status === 202) {
      await delay(COMMAND_POLL_MS, signal)
      continue
    }
    if (!response.ok) throw new Error(`Remote result HTTP ${response.status}`)
    const payload = await response.json() as unknown
    if (!isGroupPostCommandAck(payload) || payload.result.commandId !== commandId) throw new Error('ACK Remote Control không hợp lệ.')
    return { ...payload, snapshot: acceptBridgeSnapshot(pairing, payload.snapshot) }
  }
  throw new Error('Desktop chưa ACK lệnh Remote Control trước khi hết thời gian chờ.')
}

export function isSnapshotFresh(snapshot: BridgeSnapshot, now = Date.now()): boolean {
  const age = Math.max(0, now - snapshot.generatedAt)
  return age <= Math.max(1_000, snapshot.staleAfterMs)
}
