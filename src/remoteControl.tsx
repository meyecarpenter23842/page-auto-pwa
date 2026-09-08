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

function ControlIcon({ name }: { name: 'stop' | 'pause' | 'play' }) {
  if (name === 'stop') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" /></svg>
  if (name === 'pause') return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="6" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="13.5" y="6" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
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

  const canStop = online && pairing !== null && pending === null && VALID_FROM.stop.has(page.runtimeStatus)
  const canPause = online && pairing !== null && pending === null && VALID_FROM.pause.has(page.runtimeStatus)
  const primaryAction: GroupPostCommandAction = page.runtimeStatus === 'paused' ? 'resume' : 'start'
  const canPrimary = online && pairing !== null && pending === null && VALID_FROM[primaryAction].has(page.runtimeStatus)
  const primaryLabel = primaryAction === 'resume' ? 'Tiếp tục' : 'Chạy ngay'

  return <div className="remote-control" aria-label={`Điều khiển ${page.name}`}>
    <div className="remote-control__actions">
      <button className="remote-button remote-button--stop" type="button" disabled={!canStop} onClick={() => { void execute('stop') }}><span><ControlIcon name="stop" /></span><strong>{pending === 'stop' ? 'Đang dừng…' : 'Dừng'}</strong></button>
      <button className="remote-button remote-button--pause" type="button" disabled={!canPause} onClick={() => { void execute('pause') }}><span><ControlIcon name="pause" /></span><strong>{pending === 'pause' ? 'Đang dừng…' : 'Tạm dừng'}</strong></button>
      <button className="remote-button remote-button--primary" type="button" disabled={!canPrimary} onClick={() => { void execute(primaryAction) }}><span><ControlIcon name="play" /></span><strong>{pending === primaryAction ? 'Đang gửi…' : primaryLabel}</strong></button>
    </div>
    {error && <p className="remote-control__error">{error}</p>}
  </div>
}
