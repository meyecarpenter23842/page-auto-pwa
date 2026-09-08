import type { ConnectionState } from './ui'

export type AppView = 'overview' | 'pages' | 'schedule' | 'notifications' | 'settings'

type NavIcon = 'home' | 'pages' | 'calendar' | 'bell' | 'settings' | 'menu' | 'back'

function Icon({ name }: { name: NavIcon }) {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (name === 'home') return <svg {...common}><path d="m3 11 9-8 9 8v9H15v-6H9v6H3z" /></svg>
  if (name === 'pages') return <svg {...common}><path d="M5 4h11a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2zM8 8h7M8 12h5" /></svg>
  if (name === 'calendar') return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 18h2M14 18h2" /></svg>
  if (name === 'bell') return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 15 6l-.3-2.6h-4L10.4 6A7 7 0 0 0 9 7l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2.1l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.4 1l.3 2.6h4L15 18a7 7 0 0 0 1.5-1l2.4 1 2-3.4-2-1.5c.1-.4.1-.7.1-1.1z" /></svg>
  if (name === 'back') return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>
  return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
}

export function AppTopBar({ subtitle, connection, showConnection = false, back = false, onBack }: {
  subtitle: string
  connection: ConnectionState
  showConnection?: boolean
  back?: boolean
  onBack?: () => void
}) {
  const online = connection === 'online'
  return <header className="topbar topbar--polished">
    {back
      ? <button className="topbar__icon touch-button" type="button" aria-label="Quay lại" onClick={onBack}><Icon name="back" /></button>
      : <span className="topbar__icon topbar__icon--static" aria-hidden="true"><Icon name="menu" /></span>}
    <span className="app-logo app-logo--desktop" aria-hidden="true"><img src="/app-icon-512.png" alt="" /></span>
    <div className="topbar__title"><strong>Page Auto</strong><span>{subtitle}</span></div>
    {showConnection && <div className={`desktop-state desktop-state--${online ? 'online' : 'offline'}`}>
      <span><i />{online ? 'Online' : connection === 'connecting' ? 'Đang nối' : 'Offline'}</span>
      <small><i />PC {online ? 'đang chạy' : 'chưa kết nối'}</small>
    </div>}
  </header>
}

const ITEMS: Array<{ key: AppView; label: string; icon: NavIcon }> = [
  { key: 'overview', label: 'Tổng quan', icon: 'home' },
  { key: 'pages', label: 'Page', icon: 'pages' },
  { key: 'schedule', label: 'Lịch chạy', icon: 'calendar' },
  { key: 'notifications', label: 'Thông báo', icon: 'bell' },
  { key: 'settings', label: 'Cài đặt', icon: 'settings' }
]

export function AppBottomNav({ current, onNavigate, alertCount = 0 }: {
  current: AppView
  onNavigate: (view: AppView) => void
  alertCount?: number
}) {
  return <nav className="bottom-nav bottom-nav--interactive" aria-label="Điều hướng">
    {ITEMS.map(item => <button
      type="button"
      key={item.key}
      className={current === item.key ? 'is-active' : undefined}
      aria-current={current === item.key ? 'page' : undefined}
      onClick={() => onNavigate(item.key)}
    >
      <span className="bottom-nav__icon"><Icon name={item.icon} />{item.key === 'notifications' && alertCount > 0 && <i className="nav-badge">{Math.min(9, alertCount)}</i>}</span>
      <span>{item.label}</span>
    </button>)}
  </nav>
}
