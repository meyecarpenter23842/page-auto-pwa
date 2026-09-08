import { useMemo, useState } from 'react'
import type { BridgeLog, BridgePage, BridgeSnapshot } from './bridge'
import type { RelayPairing } from './pairing'
import type { ConnectionState } from './ui'

type NoticeFilter = 'all' | 'attention' | 'success'

function timeLabel(timestamp: number) {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(timestamp))
}

function NoticeGlyph({ ok }: { ok: boolean }) {
  return ok
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 17h.01" /><circle cx="12" cy="12" r="9" /></svg>
}

function pageFor(log: BridgeLog, pages: BridgePage[]) {
  return pages.find(page => page.pageTabId === log.pageTabId) ?? null
}

export function NotificationScreen({ snapshot, pages, onSelectPage }: {
  snapshot: BridgeSnapshot | null
  pages: BridgePage[]
  onSelectPage: (page: BridgePage) => void
}) {
  const [filter, setFilter] = useState<NoticeFilter>('all')
  const logs = snapshot?.recentLogs ?? []
  const attentionCount = logs.filter(log => log.result !== 'success').length
  const visible = useMemo(() => logs.filter(log => filter === 'all' || (filter === 'success' ? log.result === 'success' : log.result !== 'success')).slice(0, 30), [logs, filter])

  return <div className="screen-content secondary-screen notification-screen">
    <section className="secondary-hero">
      <div><span className="eyebrow">TRUNG TÂM THÔNG BÁO</span><h1>Hoạt động cần chú ý</h1><p>Theo dõi lỗi, tạm dừng và kết quả đăng gần nhất từ Desktop.</p></div>
      <strong>{attentionCount}</strong>
    </section>
    <div className="segmented-control" role="tablist" aria-label="Lọc thông báo">
      <button className={filter === 'all' ? 'is-active' : undefined} onClick={() => setFilter('all')}>Tất cả</button>
      <button className={filter === 'attention' ? 'is-active' : undefined} onClick={() => setFilter('attention')}>Cần chú ý</button>
      <button className={filter === 'success' ? 'is-active' : undefined} onClick={() => setFilter('success')}>Thành công</button>
    </div>
    <section className="notice-list">
      {visible.map(log => {
        const page = pageFor(log, pages)
        const ok = log.result === 'success'
        return <button key={log.id} className="notice-card touch-card" type="button" disabled={!page} onClick={() => page && onSelectPage(page)}>
          <span className={`notice-card__glyph notice-card__glyph--${ok ? 'success' : 'attention'}`}><NoticeGlyph ok={ok} /></span>
          <span className="notice-card__body"><strong>{page?.name ?? `Page #${log.pageTabId}`}</strong><span>{ok ? `Đăng Group thành công${log.groupUid ? ` · ${log.groupUid}` : ''}` : log.errorMessage || 'Tác vụ cần kiểm tra trên Desktop'}</span><small>{timeLabel(log.timestamp)}</small></span>
          <span className="notice-card__chevron">›</span>
        </button>
      })}
      {!visible.length && <div className="secondary-empty"><NoticeGlyph ok /><strong>Chưa có thông báo phù hợp</strong><span>Dữ liệu mới sẽ xuất hiện khi Desktop đồng bộ.</span></div>}
    </section>
  </div>
}

export function SettingsScreen({ pairing, connection, onForget }: {
  pairing: RelayPairing | null
  connection: ConnectionState
  onForget: () => void
}) {
  const online = connection === 'online'
  const deviceLabel = pairing?.deviceId ? `${pairing.deviceId.slice(0, 6)}…${pairing.deviceId.slice(-4)}` : 'Chưa ghép máy'
  return <div className="screen-content secondary-screen settings-screen">
    <section className="settings-identity">
      <img src="/app-icon-512.png" alt="Page Auto" />
      <div><span className="eyebrow">PAGE AUTO PWA</span><h1>Cài đặt</h1><p>Điều khiển nhẹ cho nghiệp vụ Group Post.</p></div>
    </section>
    <section className="settings-card">
      <div className="settings-card__head"><div><span>Desktop đang ghép</span><strong>{deviceLabel}</strong></div><em className={online ? 'is-online' : ''}><i />{online ? 'Online' : connection === 'connecting' ? 'Đang kết nối' : 'Offline'}</em></div>
      <div className="settings-row"><span>Đồng bộ</span><strong>Mỗi 5 giây</strong></div>
      <div className="settings-row"><span>Nguồn trạng thái</span><strong>Desktop là nguồn chuẩn</strong></div>
      <button className="settings-action settings-action--danger touch-button" type="button" disabled={!pairing} onClick={onForget}>Đổi / ghép Desktop khác</button>
      <p className="settings-note">Thao tác này chỉ xóa mã ghép trên PWA. Desktop không bị thay đổi cấu hình.</p>
    </section>
    <section className="settings-card settings-card--about">
      <div className="settings-row"><span>Ứng dụng</span><strong>Page Auto PWA</strong></div>
      <div className="settings-row"><span>Biểu tượng</span><strong>Đồng bộ từ Desktop</strong></div>
      <div className="settings-row"><span>Chế độ</span><strong>Dashboard + Remote Control</strong></div>
    </section>
  </div>
}
