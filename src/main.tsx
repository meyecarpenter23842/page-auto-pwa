import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BridgeAuthError, PairingRequiredError, acceptBridgeSnapshot, fetchBridgeSnapshot, isSnapshotFresh, type BridgePage, type BridgeSnapshot } from './bridge'
import { clearRelayPairing, consumePairingFromLocation, loadRelayPairing, parseRelayPairing, saveRelayPairing, type RelayPairing } from './pairing'
import { ConnectionPanel, OverviewScreen, PageDetailScreen, PageListScreen, ScheduleScreen, isActiveStatus, type ConnectionState } from './ui'
import { AppBottomNav, AppTopBar, type AppView } from './navigation'
import { NotificationScreen, SettingsScreen } from './secondaryScreens'
import './styles.css'
import './polish.css'
import './pwaFixes.css'

type SlideDirection = 'forward' | 'backward'
const NAV_ORDER: AppView[] = ['overview', 'pages', 'schedule', 'notifications', 'settings']
const BRIDGE_REFRESH_INTERVAL_MS = 15_000

function useBridge(pairing: RelayPairing | null) {
  const [snapshot, setSnapshot] = useState<BridgeSnapshot | null>(null)
  const [connection, setConnection] = useState<ConnectionState>(pairing ? 'connecting' : 'unpaired')
  useEffect(() => {
    if (!pairing) { setSnapshot(null); setConnection('unpaired'); return }
    let disposed = false
    let controller: AbortController | null = null
    setConnection('connecting')
    const refresh = async () => {
      controller?.abort()
      controller = new AbortController()
      try {
        const next = await fetchBridgeSnapshot(pairing, controller.signal)
        if (disposed) return
        if (!isSnapshotFresh(next)) { setSnapshot(null); setConnection('offline'); return }
        setSnapshot(next); setConnection('online')
      } catch (error) {
        if (disposed || controller.signal.aborted) return
        setSnapshot(null)
        if (error instanceof PairingRequiredError) setConnection('unpaired')
        else if (error instanceof BridgeAuthError) setConnection('unauthorized')
        else setConnection('offline')
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), BRIDGE_REFRESH_INTERVAL_MS)
    return () => { disposed = true; controller?.abort(); window.clearInterval(timer) }
  }, [pairing?.deviceId, pairing?.token])
  const acceptSnapshot = (next: BridgeSnapshot) => {
    if (!pairing || !isSnapshotFresh(next)) return
    const accepted = acceptBridgeSnapshot(pairing, next)
    setSnapshot(current => current && current.generatedAt > accepted.generatedAt ? current : accepted)
    setConnection('online')
  }
  return { snapshot, connection, acceptSnapshot }
}

function App() {
  const [pairing, setPairing] = useState<RelayPairing | null>(() => consumePairingFromLocation() ?? loadRelayPairing())
  const [pairingInput, setPairingInput] = useState('')
  const [pairingError, setPairingError] = useState<string | null>(null)
  const [view, setView] = useState<AppView>('overview')
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null)
  const [slideDirection, setSlideDirection] = useState<SlideDirection>('forward')
  const [hasNavigated, setHasNavigated] = useState(false)
  const { snapshot, connection, acceptSnapshot } = useBridge(pairing)
  const pages = useMemo(() => [...(snapshot?.pages ?? [])].sort((a, b) => (isActiveStatus(a.runtimeStatus) ? 0 : 1) - (isActiveStatus(b.runtimeStatus) ? 0 : 1) || a.pageTabId - b.pageTabId), [snapshot])
  const selectedPage = selectedPageId === null ? null : pages.find(page => page.pageTabId === selectedPageId) ?? null
  const online = connection === 'online' && snapshot !== null
  const alertCount = (snapshot?.recentLogs ?? []).filter(log => log.result !== 'success').length

  useEffect(() => { if (selectedPageId !== null && !selectedPage) setSelectedPageId(null) }, [selectedPage, selectedPageId])

  const applyPairing = () => {
    try {
      const next = parseRelayPairing(pairingInput)
      saveRelayPairing(next); setPairing(next); setPairingInput(''); setPairingError(null)
    } catch (error) { setPairingError(error instanceof Error ? error.message : 'Mã ghép không hợp lệ.') }
  }
  const forgetPairing = () => { clearRelayPairing(); setPairing(null); setPairingInput(''); setPairingError(null); setSelectedPageId(null) }

  const transition = (direction: SlideDirection, update: () => void) => {
    setSlideDirection(direction)
    setHasNavigated(true)
    update()
  }
  const navigate = (next: AppView) => {
    if (next === view && selectedPageId === null) return
    const currentIndex = selectedPageId !== null ? NAV_ORDER.indexOf('pages') : NAV_ORDER.indexOf(view)
    const nextIndex = NAV_ORDER.indexOf(next)
    transition(nextIndex >= currentIndex ? 'forward' : 'backward', () => { setSelectedPageId(null); setView(next) })
  }
  const selectPage = (page: BridgePage) => transition('forward', () => { setSelectedPageId(page.pageTabId); setView('pages') })
  const backFromPage = () => transition('backward', () => setSelectedPageId(null))

  const subtitle = selectedPage ? 'Chi tiết Page'
    : view === 'overview' ? 'Dashboard'
      : view === 'pages' ? 'Danh sách Page'
        : view === 'schedule' ? 'Lịch chạy'
          : view === 'notifications' ? 'Thông báo'
            : 'Cài đặt'

  const screen = selectedPage
    ? <PageDetailScreen page={selectedPage} pairing={pairing} online={online} logs={snapshot?.recentLogs ?? []} onSnapshot={acceptSnapshot} />
    : view === 'overview' ? <OverviewScreen snapshot={snapshot} pages={pages} online={online} onSelectPage={selectPage} />
      : view === 'pages' ? <PageListScreen pages={pages} onSelectPage={selectPage} />
        : view === 'schedule' ? <ScheduleScreen pages={pages} onSelectPage={selectPage} />
          : view === 'notifications' ? <NotificationScreen snapshot={snapshot} pages={pages} onSelectPage={selectPage} />
            : <SettingsScreen pairing={pairing} connection={connection} onForget={forgetPairing} />

  const routeKey = selectedPage ? `page-${selectedPage.pageTabId}` : view
  return <div className="app-shell">
    <AppTopBar subtitle={subtitle} connection={connection} showConnection={!selectedPage && view !== 'schedule'} back={selectedPage !== null} onBack={backFromPage} />
    <main className="main-area">
      <ConnectionPanel pairing={pairing} connection={connection} pairingInput={pairingInput} pairingError={pairingError} onInput={setPairingInput} onApply={applyPairing} onForget={forgetPairing} />
      <div key={routeKey} className={`route-frame${hasNavigated ? ` route-frame--${slideDirection}` : ''}`}>{screen}</div>
    </main>
    <AppBottomNav current={view} onNavigate={navigate} alertCount={alertCount} />
  </div>
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
if ('serviceWorker' in navigator) window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'))
