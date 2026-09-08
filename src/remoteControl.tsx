import { useState } from 'react'
import {
  sendGroupPostCommand,
  type BridgePage,
  type BridgeSnapshot,
  type GroupPostCommandAction,
  type RuntimeStatus
} from './bridge'
import type { RelayPairing } from './pairing'
import './remoteControl.css'

const VALID_FROM: Record<GroupPostCommandAction, ReadonlySet<RuntimeStatus>> = {
  start: new Set(['idle', 'stopped', 'completed', 'error']),
  pause: new Set(['starting', 'running', 'waiting_window']),
  resume: new Set(['paused']),
  stop: new Set(['starting', 'running', 'waiting_window', 'paused'])
}

function ControlIcon({ name }: { name: 'stop' | 'pause' | 'play' | 'resume' }) {
  if (name === 'stop') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" /></svg>
  if (name === 'pause') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="6" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="13.5" y="6" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
  if (name === 'resume') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7v10M9 12h8M14 8l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 6 10 6-10 6z" fill="currentColor" /></svg>
}

export function GroupPostRemoteControl({ page, pairing, online, onSnapshot }: {
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
      if (!ack.result.ok) setError(ack.result.message || 'Desktop từ chối lệnh điều khiển.')
    } catch (commandError) {
      setError(commandError instanceof Error ? commandError.message : 'Không gửi được lệnh điều khiển.')
    } finally {
      setPending(null)
    }
  }

  const ready = online && pairing !== null && pending === null
  const can = (action: GroupPostCommandAction) => ready && VALID_FROM[action].has(page.runtimeStatus)
  const controls: Array<{ action: GroupPostCommandAction; label: string; pendingLabel: string; icon: 'stop' | 'pause' | 'play' | 'resume'; tone: string }> = [
    { action: 'stop', label: 'Dừng', pendingLabel: 'Đang dừng…', icon: 'stop', tone: 'stop' },
    { action: 'start', label: 'Chạy', pendingLabel: 'Đang chạy…', icon: 'play', tone: 'start' },
    { action: 'pause', label: 'Tạm dừng', pendingLabel: 'Đang tạm…', icon: 'pause', tone: 'pause' },
    { action: 'resume', label: 'Tiếp tục', pendingLabel: 'Đang tiếp…', icon: 'resume', tone: 'resume' }
  ]

  return <div className="remote-control" aria-label={`Điều khiển ${page.name}`}>
    <div className="remote-control__actions remote-control__actions--four">
      {controls.map(control => <button
        className={`remote-button remote-button--${control.tone}`}
        type="button"
        key={control.action}
        disabled={!can(control.action)}
        onClick={() => { void execute(control.action) }}
      >
        <span><ControlIcon name={control.icon} /></span>
        <strong>{pending === control.action ? control.pendingLabel : control.label}</strong>
      </button>)}
    </div>
    {error && <p className="remote-control__error">{error}</p>}
  </div>
}
