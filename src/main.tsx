import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { fetchBridgeSnapshot, isSnapshotFresh, type BridgePage, type BridgeSnapshot, type RuntimeStatus } from './bridge'
import './styles.css'

type ConnectionState = 'connecting' | 'online' | 'offline'

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const STATUS_LABELS: Record<RuntimeStatus, string> = {
  idle: 'Chờ chạy',
  starting: 'Đang khởi động',
  running: 'Đang chạy',
  paused: 'Tạm dừng',
  waiting_window: 'Chờ khung giờ',
  stopping: 'Đang dừng',
  stopped: 'Đã dừng',
  completed: 'Hoàn tất',
  error: 'Có lỗi'
}

function formatTime(timestamp: number | null): string {
  if (timestamp === null) return '—'
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp))
}

function formatDateTime(timestamp: number | null): string {
  if (timestamp === null) return 'Chưa có lịch tiếp theo'
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))
}

function formatMinute(minute: number): string {
  const hour = Math.floor(minute / 60)
  const mins = minute % 60
  return `${String(hour).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function statusTone(status: RuntimeStatus): string {
  if (status === 'running' || status === 'starting') return 'good'
  if (status === 'paused' || status === 'waiting_window') return 'warn'
  if (status === 'error') return 'bad'
  return 'neutral'
}

function currentAccountLabel(page: BridgePage): string {
  const account = page.accounts.find((item) => item.accountId === page.currentAccountId)
  if (!account) return 'Chưa có tài khoản chạy'
  return account.name?.trim() || account.uid
}

function PageCard({ page }: { page: BridgePage }) {
  const progress = Math.max(0, Math.min(100, page.progress?.percent ?? 0))
  const visibleSchedules = page.schedules.slice(0, 3)

  return (
    <article className="page-card">
      <div className="page-card__head">
        <div className="page-avatar" aria-hidden="true">P</div>
        <div className="page-identity">
          <strong>{page.name}</strong>
          <span>UID {page.pageUid}</span>
        </div>
        <span className={`status-pill status-pill--${statusTone(page.runtimeStatus)}`}>
          <i />{STATUS_LABELS[page.runtimeStatus]}
        </span>
      </div>

      <div className="progress-row">
        <div className="progress-copy">
          <span>Tiến độ phiên</span>
          <strong>{page.progress ? `${page.progress.success}/${page.progress.total}` : '—'}</strong>
        </div>
        <div className="progress-track" aria-label={`Tiến độ ${progress}%`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-percent">{page.progress ? `${Math.round(progress)}%` : '—'}</span>
      </div>

      <div className="task-grid">
        <div className="task-cell">
          <span className="task-label">Tài khoản hiện tại</span>
          <strong>{currentAccountLabel(page)}</strong>
          <small>{page.currentAccountId ? `#${page.currentAccountId}` : `${page.accountCount} tài khoản đã cấu hình`}</small>
        </div>
        <div className="task-cell">
          <span className="task-label">Group hiện tại</span>
          <strong>{page.currentGroupUid || 'Chưa vào Group'}</strong>
          <small>{page.progress ? `${page.progress.remaining} Group còn lại` : `${page.groupCount} Group nguồn`}</small>
        </div>
      </div>

      {page.currentPost && (
        <div className="current-post">
          <span className="pulse-dot" />
          <div>
            <span>Đang xử lý bài #{page.currentPost.postIndex + 1}</span>
            <p>{page.currentPost.contentPreview || 'Bài viết không có nội dung text'}</p>
          </div>
          <b>{page.currentPost.imageCount} ảnh</b>
        </div>
      )}

      <div className="page-meta">
        <div><span>TK song song</span><strong>{page.accountConcurrency}</strong></div>
        <div><span>Bài / TK</span><strong>{page.postsPerAccount}</strong></div>
        <div><span>Thành công hôm nay</span><strong>{page.today.success}</strong></div>
        <div><span>Lỗi hôm nay</span><strong className={page.today.failed > 0 ? 'danger-text' : undefined}>{page.today.failed}</strong></div>
      </div>

      <div className="schedule-strip">
        <div className="schedule-title">
          <span className="calendar-icon" aria-hidden="true">▦</span>
          <div><strong>Lịch đăng nhóm</strong><small>{formatDateTime(page.nextActionAt)}</small></div>
        </div>
        <div className="schedule-times">
          {visibleSchedules.length > 0 ? visibleSchedules.map((schedule, index) => (
            <span key={`${schedule.dayOfWeek}-${schedule.startMinute}-${index}`} className={schedule.status === 'running' ? 'is-active' : undefined}>
              {DAY_LABELS[schedule.dayOfWeek] ?? '?'} {formatMinute(schedule.startMinute)}–{formatMinute(schedule.endMinute)}
            </span>
          )) : <span>Chưa cấu hình lịch</span>}
        </div>
      </div>

      {page.message && <p className="runtime-message">{page.message}</p>}
    </article>
  )
}

function useBridge() {
  const [snapshot, setSnapshot] = useState<BridgeSnapshot | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connecting')

  useEffect(() => {
    let disposed = false
    let activeController: AbortController | null = null

    const refresh = async () => {
      activeController?.abort()
      const controller = new AbortController()
      activeController = controller
      try {
        const next = await fetchBridgeSnapshot(controller.signal)
        if (disposed) return
        if (!isSnapshotFresh(next)) {
          setSnapshot(null)
          setConnection('offline')
          return
        }
        setSnapshot(next)
        setConnection('online')
      } catch {
        if (disposed || controller.signal.aborted) return
        setSnapshot(null)
        setConnection('offline')
      }
    }

    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 5_000)
    return () => {
      disposed = true
      activeController?.abort()
      window.clearInterval(timer)
    }
  }, [])

  return { snapshot, connection }
}

function MetricCard({ label, value, note, tone = 'plain' }: { label: string; value: React.ReactNode; note: string; tone?: 'plain' | 'success' | 'danger' }) {
  return (
    <div className={`metric-card metric-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  )
}

function App() {
  const { snapshot, connection } = useBridge()
  const pages = useMemo(() => [...(snapshot?.pages ?? [])].sort((a, b) => {
    const aActive = ['running', 'starting', 'waiting_window'].includes(a.runtimeStatus) ? 0 : 1
    const bActive = ['running', 'starting', 'waiting_window'].includes(b.runtimeStatus) ? 0 : 1
    return aActive - bActive || a.pageTabId - b.pageTabId
  }), [snapshot])
  const isOnline = connection === 'online' && snapshot !== null

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">PA</div>
        <div className="brand-copy"><strong>PAGE AUTO</strong><span>Group Scheduler</span></div>
        <div className={`connection-badge connection-badge--${connection}`}>
          <i />{connection === 'connecting' ? 'Đang nối' : isOnline ? 'Desktop Online' : 'Desktop Offline'}
        </div>
      </header>

      <main>
        <section className="hero">
          <div>
            <span className="section-kicker">BẢNG ĐIỀU KHIỂN</span>
            <h1>Hẹn giờ đăng nhóm</h1>
            <p>Theo dõi các Page đang chạy trực tiếp từ PAGE-AUTO trên máy tính.</p>
          </div>
          <div className="sync-box">
            <span>Lần đồng bộ</span>
            <strong>{snapshot ? formatTime(snapshot.generatedAt) : '—'}</strong>
          </div>
        </section>

        {!isOnline && (
          <section className="offline-banner">
            <div className="offline-icon">⌁</div>
            <div>
              <strong>Chưa nhận được dữ liệu từ máy tính</strong>
              <p>Mở PAGE-AUTO trên Windows và giữ ứng dụng hoạt động. Dashboard sẽ tự kết nối lại.</p>
            </div>
          </section>
        )}

        <section className="metrics-grid" aria-label="Tổng quan hôm nay">
          <MetricCard label="Page hoạt động" value={snapshot ? `${snapshot.summary.activePages}/${snapshot.summary.totalPages}` : '—'} note={`${snapshot?.summary.pausedPages ?? 0} đang tạm dừng`} />
          <MetricCard label="Đăng thành công" value={snapshot?.summary.successToday ?? '—'} note="Hôm nay" tone="success" />
          <MetricCard label="Bài lỗi" value={snapshot?.summary.failedToday ?? '—'} note="Hôm nay" tone={snapshot?.summary.failedToday ? 'danger' : 'plain'} />
          <MetricCard label="Lượt kế tiếp" value={snapshot?.summary.nextActionAt ? formatTime(snapshot.summary.nextActionAt) : '—'} note={snapshot?.summary.nextActionAt ? formatDateTime(snapshot.summary.nextActionAt) : 'Chưa có lịch'} />
        </section>

        <section className="section-block">
          <div className="section-head">
            <div><span className="section-kicker">PAGE TABS</span><h2>Đang theo dõi</h2></div>
            <span className="count-badge">{pages.length}</span>
          </div>
          <div className="page-list">
            {pages.length > 0 ? pages.map((page) => <PageCard key={page.pageTabId} page={page} />) : (
              <div className="empty-card">
                <div className="empty-icon">P</div>
                <strong>{isOnline ? 'Chưa có Page hẹn giờ nhóm' : 'Đang chờ PAGE-AUTO'}</strong>
                <p>{isOnline ? 'Tạo hoặc cấu hình Page Tab trên desktop để Page xuất hiện tại đây.' : 'Khi desktop kết nối, danh sách Page và tiến độ thật sẽ xuất hiện tự động.'}</p>
              </div>
            )}
          </div>
        </section>

        <section className="section-block activity-section">
          <div className="section-head">
            <div><span className="section-kicker">NHẬT KÝ</span><h2>Hoạt động gần đây</h2></div>
          </div>
          <div className="activity-list">
            {(snapshot?.recentLogs ?? []).slice(0, 6).map((log) => (
              <div className="activity-row" key={log.id}>
                <span className={`activity-dot activity-dot--${log.result === 'success' ? 'success' : 'failed'}`} />
                <div className="activity-copy">
                  <strong>{log.result === 'success' ? 'Đăng Group thành công' : 'Tác vụ cần chú ý'}</strong>
                  <span>Group {log.groupUid}{log.accountId ? ` · TK #${log.accountId}` : ''}</span>
                  {log.errorMessage && <small>{log.errorMessage}</small>}
                </div>
                <time>{formatTime(log.timestamp)}</time>
              </div>
            ))}
            {isOnline && (snapshot?.recentLogs.length ?? 0) === 0 && <div className="activity-empty">Chưa có hoạt động đăng Group gần đây.</div>}
            {!isOnline && <div className="activity-empty">Nhật ký sẽ hiển thị khi desktop online.</div>}
          </div>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="Điều hướng dashboard">
        <div className="nav-item nav-item--active"><span>⌂</span><strong>Tổng quan</strong></div>
        <div className="nav-item"><span>▦</span><strong>Lịch chạy</strong></div>
        <div className="nav-item"><span>≡</span><strong>Nhật ký</strong></div>
      </nav>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js') })
}
