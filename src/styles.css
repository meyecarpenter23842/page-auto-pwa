import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { BridgeAuthError, PairingRequiredError, acceptBridgeSnapshot, fetchBridgeSnapshot, isSnapshotFresh, type BridgePage, type BridgeSnapshot } from './bridge'
import { clearRelayPairing, consumePairingFromLocation, loadRelayPairing, parseRelayPairing, saveRelayPairing, type RelayPairing } from './pairing'
import { BottomNav, ConnectionPanel, OverviewScreen, PageDetailScreen, PageListScreen, ScheduleScreen, TopBar, isActiveStatus, type AppView, type ConnectionState } from './ui'
import './styles.css'

function useBridge(pairing:RelayPairing|null){
  const [snapshot,setSnapshot]=useState<BridgeSnapshot|null>(null),[connection,setConnection]=useState<ConnectionState>(pairing?'connecting':'unpaired')
  useEffect(()=>{if(!pairing){setSnapshot(null);setConnection('unpaired');return}let disposed=false,controller:AbortController|null=null;setConnection('connecting');const refresh=async()=>{controller?.abort();controller=new AbortController();try{const next=await fetchBridgeSnapshot(pairing,controller.signal);if(disposed)return;if(!isSnapshotFresh(next)){setSnapshot(null);setConnection('offline');return}setSnapshot(next);setConnection('online')}catch(error){if(disposed||controller.signal.aborted)return;setSnapshot(null);if(error instanceof PairingRequiredError)setConnection('unpaired');else if(error instanceof BridgeAuthError)setConnection('unauthorized');else setConnection('offline')}};void refresh();const timer=window.setInterval(()=>void refresh(),5000);return()=>{disposed=true;controller?.abort();window.clearInterval(timer)}},[pairing?.deviceId,pairing?.token])
  const acceptSnapshot=(next:BridgeSnapshot)=>{if(!pairing||!isSnapshotFresh(next))return;const accepted=acceptBridgeSnapshot(pairing,next);setSnapshot(current=>current&&current.generatedAt>accepted.generatedAt?current:accepted);setConnection('online')}
  return{snapshot,connection,acceptSnapshot}
}

function App(){
  const [pairing,setPairing]=useState<RelayPairing|null>(()=>consumePairingFromLocation()??loadRelayPairing()),[pairingInput,setPairingInput]=useState(''),[pairingError,setPairingError]=useState<string|null>(null),[view,setView]=useState<AppView>('overview'),[selectedPageId,setSelectedPageId]=useState<number|null>(null)
  const {snapshot,connection,acceptSnapshot}=useBridge(pairing)
  const pages=useMemo(()=>[...(snapshot?.pages??[])].sort((a,b)=>(isActiveStatus(a.runtimeStatus)?0:1)-(isActiveStatus(b.runtimeStatus)?0:1)||a.pageTabId-b.pageTabId),[snapshot])
  const selectedPage=selectedPageId===null?null:pages.find(p=>p.pageTabId===selectedPageId)??null,online=connection==='online'&&snapshot!==null
  useEffect(()=>{if(selectedPageId!==null&&!selectedPage)setSelectedPageId(null)},[selectedPage,selectedPageId])
  const applyPairing=()=>{try{const next=parseRelayPairing(pairingInput);saveRelayPairing(next);setPairing(next);setPairingInput('');setPairingError(null)}catch(error){setPairingError(error instanceof Error?error.message:'Mã ghép không hợp lệ.')}}
  const forgetPairing=()=>{clearRelayPairing();setPairing(null);setPairingInput('');setPairingError(null);setSelectedPageId(null)}
  const navigate=(next:AppView)=>{setSelectedPageId(null);setView(next)},selectPage=(page:BridgePage)=>{setSelectedPageId(page.pageTabId);setView('pages')}
  const subtitle=selectedPage?'Chi tiết Page':view==='overview'?'Dashboard':view==='pages'?'Danh sách Page':'Lịch chạy'
  return <div className="app-shell"><TopBar subtitle={subtitle} connection={connection} showConnection={!selectedPage&&view!=='schedule'} back={selectedPage!==null} onBack={()=>setSelectedPageId(null)}/><main className="main-area"><ConnectionPanel pairing={pairing} connection={connection} pairingInput={pairingInput} pairingError={pairingError} onInput={setPairingInput} onApply={applyPairing} onForget={forgetPairing}/>{selectedPage?<PageDetailScreen page={selectedPage} pairing={pairing} online={online} logs={snapshot?.recentLogs??[]} onSnapshot={acceptSnapshot}/>:view==='overview'?<OverviewScreen snapshot={snapshot} pages={pages} online={online} onSelectPage={selectPage}/>:view==='pages'?<PageListScreen pages={pages} onSelectPage={selectPage}/>:<ScheduleScreen pages={pages} onSelectPage={selectPage}/>}</main><BottomNav current={view} onNavigate={navigate}/></div>
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
if('serviceWorker'in navigator)window.addEventListener('load',()=>void navigator.serviceWorker.register('/sw.js'))
