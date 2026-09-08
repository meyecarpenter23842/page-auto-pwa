import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'

function App() {
  return (
    <main className="shell">
      <header>
        <p className="eyebrow">Page Auto</p>
        <h1>Dashboard mobile</h1>
        <p>Theo dõi Page, lịch chạy nhóm và thao tác Start / Pause / Stop.</p>
      </header>
      <section className="card">
        <strong>Hạ tầng deploy đã sẵn sàng</strong>
        <span>UI thật sẽ được nối với desktop API ở lô tiếp theo.</span>
      </section>
    </main>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}
