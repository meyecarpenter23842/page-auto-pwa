import { useState } from 'react'
import { sendGroupPostCommand, type BridgePage, type BridgeSnapshot, type GroupPostCommandAction, type RuntimeStatus } from './bridge'
import type { RelayPairing } from './pairing'
import './remoteControl.css'

const ACTION_LABELS: Record<GroupPostCommandAction, string> = {
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  stop: 'Stop'
}

const VALID_FROM: Record<GroupPostCommandAction, ReadonlySet<RuntimeStatus>> = {
  start: new Set(['idle', 'stopped', 'completed', 'error']),
  pause: new Set(['starting', 'running', 'waiting_window']),
  resume: new Set(['paused']),
  stop: new Set(['starting', 'running', 'waiting_window', 'paused'])
}

export function GroupPostRemoteControl({
  page,
  pairing,
  online,
  onSnapshot
}: {
  page: BridgePage
  pairing: RelayPairing | null
  online: boolean
  onSnapshot: (snapshot: BridgeSnapshot) => void
}) {
  const [pending, setPending] = useState<GroupPostCommandAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  const execute = async (action: GroupPostCommandAction) => {
    if (!pairing || !online || pending || !VALID_FROM[action].has(page.runtimeStatus)) return
    setPending(action)
    setError(null)
    try {
      const ack = await sendGroupPostCommand(pairing, page.pageTabId, action)
      onSnapshot(ack.snapshot)
      if (!ack.result.ok) setError(ack.result.message || `Desktop từ chối lệnh ${ACTION_LABELS[action]}.`)
    } catch (commandError) {
      setError(commandError instanceof Error ? commandError.message : 'Không gửi được lệnh Remote Control.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="remote-control" aria-label={`Remote Control ${page.name}`}>
      <div className="remote-control__head">
        <div><strong>Remote Control</strong><span>group_post · trạng thái desktop là nguồn chuẩn</span></div>
        {pending && <small>Đang chờ ACK {ACTION_LABELS[pending]}…</small>}
      </div>
      <div className="remote-control__actions">
        {(Object.keys(ACTION_LABELS) as GroupPostCommandAction[]).map((action) => {
          const enabled = online && pairing !== null && pending === null && VALID_FROM[action].has(page.runtimeStatus)
          return (
            <button
              key={action}
              type="button"
              className={`remote-button remote-button--${action}`}
              disabled={!enabled}
              onClick={() => { void execute(action) }}
            >
              {ACTION_LABELS[action]}
            </button>
          )
        })}
      </div>
      {error && <p className="remote-control__error">{error}</p>}
    </div>
  )
}
