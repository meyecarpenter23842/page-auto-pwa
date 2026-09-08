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

const DEFAULT_SNAPSHOT_ENDPOINT = '/api/pwa/snapshot'

function snapshotEndpoint(): string {
  const configured = import.meta.env.VITE_PAGE_AUTO_SNAPSHOT_URL?.trim()
  return configured || DEFAULT_SNAPSHOT_ENDPOINT
}

export async function fetchBridgeSnapshot(signal?: AbortSignal): Promise<BridgeSnapshot> {
  const response = await fetch(snapshotEndpoint(), {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal
  })
  if (!response.ok) throw new Error(`Bridge HTTP ${response.status}`)
  const payload = await response.json() as Partial<BridgeSnapshot>
  if (payload.schemaVersion !== 1 || typeof payload.generatedAt !== 'number' || !Array.isArray(payload.pages)) {
    throw new Error('Bridge snapshot không hợp lệ.')
  }
  return payload as BridgeSnapshot
}

export function isSnapshotFresh(snapshot: BridgeSnapshot, now = Date.now()): boolean {
  const age = Math.max(0, now - snapshot.generatedAt)
  return age <= Math.max(1_000, snapshot.staleAfterMs)
}
