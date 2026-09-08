import { useMemo, useState } from 'react'
import type { RelayPairing } from './pairing'
import type { BridgeLog, BridgePage, BridgeSchedule, BridgeSnapshot, RuntimeStatus, WindowRuntimeStatus } from './bridge'
import { GroupPostRemoteControl } from './remoteControl'

export type ConnectionState = 'connecting' | 'online' | 'offline' | 'unpaired' | 'unauthorized'
export type AppView = 'overview' | 'pages' | 'schedule'
type PageDetailTab = 'overview' | 'schedule' | 'groups' | 'logs'
type PageFilter = 'all' | 'running' | 'scheduled'
type IconName = 'menu'|'home'|'pages'|'calendar'|'bell'|'settings'|'search'|'back'|'more'|'play'|'clock'|'check'|'error'|'pause'|'users'|'image'|'chevron'|'info'

const DAY_LABELS = ['CN','T2','T3','T4','T5','T6','T7']
const WEEK_LABELS = ['T2','T3','T4','T5','T6','T7','CN']
const STATUS_LABELS: Record<RuntimeStatus,string> = {
  idle:'Đã lên lịch', starting:'Đang khởi động', running:'Đang chạy', paused:'Tạm dừng', waiting_window:'Đã lên lịch',
  stopping:'Đang dừng', stopped:'Đã dừng', completed:'Đã chạy xong', error:'Lỗi'
}

function Icon({name,size=20}:{name:IconName;size?:number}) {
  const p={width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true}
  if(name==='menu')return <svg {...p}><path d="M4 7h16M4 12h16M4 17h16"/></svg>
  if(name==='home')return <svg {...p}><path d="m3 11 9-8 9 8v9H15v-6H9v6H3z"/></svg>
  if(name==='pages')return <svg {...p}><path d="M5 4h11a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2zM8 8h7M8 12h5"/></svg>
  if(name==='calendar')return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h2M14 14h2M8 18h2M14 18h2"/></svg>
  if(name==='bell')return <svg {...p}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
  if(name==='settings')return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 15 6l-.3-2.6h-4L10.4 6A7 7 0 0 0 9 7l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2.1l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.4 1l.3 2.6h4L15 18a7 7 0 0 0 1.5-1l2.4 1 2-3.4-2-1.5c.1-.4.1-.7.1-1.1z"/></svg>
  if(name==='search')return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
  if(name==='back')return <svg {...p}><path d="m15 18-6-6 6-6"/></svg>
  if(name==='more')return <svg {...p}><circle cx="12" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/></svg>
  if(name==='play')return <svg {...p}><path d="m9 7 8 5-8 5z" fill="currentColor" stroke="none"/></svg>
  if(name==='clock')return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
  if(name==='check')return <svg {...p}><path d="m5 12 4 4 10-10"/></svg>
  if(name==='error')return <svg {...p}><path d="m7 7 10 10M17 7 7 17"/></svg>
  if(name==='pause')return <svg {...p}><path d="M9 7v10M15 7v10"/></svg>
  if(name==='users')return <svg {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>
  if(name==='image')return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>
  if(name==='chevron')return <svg {...p}><path d="m9 18 6-6-6-6"/></svg>
  return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>
}
function Logo(){return <span className="app-logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5.8 16.8 11.2 7a1 1 0 0 1 1.7 0l5.3 9.8"/><path d="m8.7 13.1 3.3-2.6 3.3 2.6"/><circle cx="6.1" cy="17.1" r="1.3"/><circle cx="17.9" cy="17.1" r="1.3"/></svg></span>}
function fmtTime(t:number|null){return t===null?'—':new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit'}).format(new Date(t))}
function fmtMinute(m:number){return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}
function tone(s:RuntimeStatus):'green'|'blue'|'orange'|'red'|'gray'{if(s==='running'||s==='starting'||s==='completed')return'green';if(s==='paused')return'orange';if(s==='error')return'red';return'gray'}
function scheduleState(s:WindowRuntimeStatus|null){if(s==='running')return{label:'Đang chạy',tone:'blue'} as const;if(s==='closed_account_cycle'||s==='closed_time_remaining_accounts')return{label:'Đã chạy xong',tone:'green'} as const;return{label:'Chưa chạy',tone:'gray'} as const}
export function isActiveStatus(s:RuntimeStatus){return s==='running'||s==='starting'||s==='waiting_window'}
function isScheduledStatus(s:RuntimeStatus){return s==='idle'||s==='waiting_window'||s==='stopped'||s==='completed'}
function Avatar({page,size='md'}:{page:BridgePage;size?:'sm'|'md'|'lg'}){return <span className={`page-avatar page-avatar--${size} page-avatar--v${page.pageTabId%6+1}`} aria-hidden="true">{page.name.trim().charAt(0).toUpperCase()||'P'}</span>}

export function TopBar({subtitle,connection,showConnection=false,back=false,onBack}:{subtitle:string;connection:ConnectionState;showConnection?:boolean;back?:boolean;onBack?:()=>void}){
  const online=connection==='online'
  return <header className="topbar">
    {back?<button className="topbar__icon" type="button" aria-label="Quay lại" onClick={onBack}><Icon name="back" size={25}/></button>:<span className="topbar__icon topbar__icon--static" aria-hidden="true"><Icon name="menu" size={25}/></span>}
    <Logo/><div className="topbar__title"><strong>Page Auto</strong><span>{subtitle}</span></div>
    {showConnection&&<div className={`desktop-state desktop-state--${online?'online':'offline'}`}><span><i/>{online?'Online':connection==='connecting'?'Đang nối':'Offline'}</span><small><i/>PC {online?'đang chạy':'chưa kết nối'}</small></div>}
  </header>
}
export function BottomNav({current,onNavigate}:{current:AppView;onNavigate:(v:AppView)=>void}){return <nav className="bottom-nav" aria-label="Điều hướng">
  <button type="button" className={current==='overview'?'is-active':undefined} onClick={()=>onNavigate('overview')}><Icon name="home"/><span>Tổng quan</span></button>
  <button type="button" className={current==='pages'?'is-active':undefined} onClick={()=>onNavigate('pages')}><Icon name="pages"/><span>Page</span></button>
  <button type="button" className={current==='schedule'?'is-active':undefined} onClick={()=>onNavigate('schedule')}><Icon name="calendar"/><span>Lịch chạy</span></button>
  <span className="is-muted" aria-hidden="true"><Icon name="bell"/><span>Thông báo</span></span><span className="is-muted" aria-hidden="true"><Icon name="settings"/><span>Cài đặt</span></span>
</nav>}

export function ConnectionPanel({pairing,connection,pairingInput,pairingError,onInput,onApply,onForget}:{pairing:RelayPairing|null;connection:ConnectionState;pairingInput:string;pairingError:string|null;onInput:(v:string)=>void;onApply:()=>void;onForget:()=>void}){
  if(pairing&&connection==='online')return null
  if(!pairing)return <section className="connection-panel"><div className="connection-panel__icon"><Icon name="info"/></div><div className="connection-panel__body"><strong>Ghép PWA với PAGE-AUTO</strong><p>Mở <b>data/pwa-relay/pairing.txt</b> trên máy tính, mở link ghép hoặc dán mã bên dưới.</p><div className="pairing-form"><input value={pairingInput} onChange={e=>onInput(e.target.value)} placeholder="Dán link hoặc mã ghép" autoCapitalize="off" autoCorrect="off"/><button type="button" onClick={onApply}>Ghép máy</button></div>{pairingError&&<small className="form-error">{pairingError}</small>}</div></section>
  return <section className="connection-panel connection-panel--warning"><div className="connection-panel__icon"><Icon name="clock"/></div><div className="connection-panel__body"><strong>{connection==='unauthorized'?'Mã ghép không khớp máy tính':'Chưa nhận được dữ liệu từ máy tính'}</strong><p>{connection==='unauthorized'?'Ghép lại bằng link mới trong pairing.txt của PAGE-AUTO.':'Mở PAGE-AUTO trên Windows. Dashboard sẽ tự nối lại khi Desktop hoạt động.'}</p>{connection==='unauthorized'&&<button className="secondary-action" type="button" onClick={onForget}>Đổi máy</button>}</div></section>
}

export function OverviewScreen({snapshot,pages,online,onSelectPage}:{snapshot:BridgeSnapshot|null;pages:BridgePage[];online:boolean;onSelectPage:(p:BridgePage)=>void}){
  const running=pages.filter(p=>isActiveStatus(p.runtimeStatus)).length
  const scheduled=pages.filter(p=>isScheduledStatus(p.runtimeStatus)&&!isActiveStatus(p.runtimeStatus)).length
  const issues=pages.filter(p=>p.runtimeStatus==='paused'||p.runtimeStatus==='error'||p.runtimeStatus==='stopping').length
  const byId=useMemo(()=>new Map(pages.map(p=>[p.pageTabId,p])),[pages]);const recent=(snapshot?.recentLogs??[]).slice(0,5)
  return <div className="screen-content overview-screen">
    <section className="overview-cards">
      <div className="overview-card overview-card--blue"><span className="overview-card__icon"><Icon name="play" size={22}/></span><div><span>Đang chạy</span><strong>{snapshot?running:'—'}</strong><small>{snapshot?`/ ${snapshot.summary.totalPages} Page`:'Page'}</small></div></div>
      <div className="overview-card overview-card--gray"><span className="overview-card__icon"><Icon name="clock" size={21}/></span><div><span>Đã lên lịch</span><strong>{snapshot?scheduled:'—'}</strong><small>Page</small></div></div>
      <div className="overview-card overview-card--green"><span className="overview-card__icon"><Icon name="check" size={23}/></span><div><span>Đăng thành công</span><strong>{snapshot?.summary.successToday??'—'}</strong><small>hôm nay</small></div></div>
      <div className="overview-card overview-card--red"><span className="overview-card__icon"><Icon name="error" size={22}/></span><div><span>Lỗi / Tạm dừng</span><strong>{snapshot?issues:'—'}</strong><small>Page</small></div></div>
    </section>
    <section className="dashboard-section"><div className="section-title"><h2>Hoạt động gần đây</h2><span className="section-link">Xem tất cả</span></div><div className="activity-list">
      {recent.map(log=>{const page=byId.get(log.pageTabId),ok=log.result==='success',paused=log.action.toLowerCase().includes('pause');return <button className="activity-row" type="button" key={log.id} onClick={()=>page&&onSelectPage(page)} disabled={!page}><span className={`round-action round-action--${ok?'blue':paused?'orange':'red'}`}><Icon name={ok?'play':paused?'pause':'error'} size={16}/></span><span className="activity-row__copy"><strong>{page?.name??`Page #${log.pageTabId}`}</strong><small>{ok?`Đã đăng bài vào nhóm: ${log.groupUid||'—'}`:log.errorMessage||(paused?'Tạm dừng theo lệnh người dùng':'Tác vụ cần chú ý')}</small></span><time>{fmtTime(log.timestamp)}</time></button>})}
      {recent.length===0&&<div className="empty-inline">{online?'Chưa có hoạt động gần đây.':'Nhật ký sẽ hiển thị khi Desktop online.'}</div>}
    </div></section>
    <section className="dashboard-section resource-block"><div className="section-title"><h2>Tài nguyên hệ thống (PC)</h2><span className={`resource-state ${online?'is-online':''}`}><i/>{online?'Đã kết nối':'Offline'}</span></div><div className="resource-list">{['CPU','RAM','Chrome (Playwright)'].map(label=><div className="resource-row" key={label}><span>{label}</span><div className="resource-track"/><strong>—</strong></div>)}</div></section>
  </div>
}

export function PageListScreen({pages,onSelectPage}:{pages:BridgePage[];onSelectPage:(p:BridgePage)=>void}){
  const [query,setQuery]=useState(''),[filter,setFilter]=useState<PageFilter>('all')
  const counts={all:pages.length,running:pages.filter(p=>isActiveStatus(p.runtimeStatus)).length,scheduled:pages.filter(p=>isScheduledStatus(p.runtimeStatus)&&!isActiveStatus(p.runtimeStatus)).length}
  const visible=pages.filter(p=>{if(!`${p.name} ${p.pageUid}`.toLowerCase().includes(query.trim().toLowerCase()))return false;if(filter==='running')return isActiveStatus(p.runtimeStatus);if(filter==='scheduled')return isScheduledStatus(p.runtimeStatus)&&!isActiveStatus(p.runtimeStatus);return true})
  return <div className="screen-content page-list-screen"><label className="search-box"><Icon name="search" size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm Page..."/></label><div className="filter-chips"><button className={filter==='all'?'is-active':undefined} onClick={()=>setFilter('all')}>Tất cả ({counts.all})</button><button className={filter==='running'?'is-active':undefined} onClick={()=>setFilter('running')}>Đang chạy ({counts.running})</button><button className={filter==='scheduled'?'is-active':undefined} onClick={()=>setFilter('scheduled')}>Đã lên lịch ({counts.scheduled})</button></div><div className="page-directory">
    {visible.map(page=><button type="button" className="page-directory-row" key={page.pageTabId} onClick={()=>onSelectPage(page)}><Avatar page={page}/><span className="page-directory-row__main"><strong>{page.name}</strong><small>UID: {page.pageUid}</small><em className={`status-text status-text--${tone(page.runtimeStatus)}`}><i/>{STATUS_LABELS[page.runtimeStatus]}</em></span><span className="page-directory-row__progress"><strong>{page.today.success}/{page.progress?.total??page.groupCount}</strong><small>hôm nay</small></span><span className="more-button"><Icon name="more"/></span></button>)}
    {visible.length===0&&<div className="empty-inline empty-inline--large">Không có Page phù hợp.</div>}
  </div></div>
}

function ScheduleRow({schedule,articles}:{schedule:BridgeSchedule;articles:number}){const s=scheduleState(schedule.status);return <div className="detail-schedule-row"><strong>{fmtMinute(schedule.startMinute)} - {fmtMinute(schedule.endMinute)}</strong><span className={`schedule-state schedule-state--${s.tone}`}><i/>{s.label}</span><span>{articles} bài</span><Icon name="more" size={18}/></div>}
function Logs({logs}:{logs:BridgeLog[]}){if(!logs.length)return <div className="empty-inline empty-inline--large">Chưa có log gần đây cho Page này.</div>;return <div className="detail-log-list">{logs.slice(0,12).map(log=><div className="detail-log-row" key={log.id}><span className={`round-action ${log.result==='success'?'round-action--green':'round-action--red'}`}><Icon name={log.result==='success'?'check':'error'} size={15}/></span><div><strong>{log.result==='success'?'Đăng Group thành công':'Tác vụ cần chú ý'}</strong><small>{log.groupUid||'—'}{log.errorMessage?` · ${log.errorMessage}`:''}</small></div><time>{fmtTime(log.timestamp)}</time></div>)}</div>}

export function PageDetailScreen({page,pairing,online,logs,onSnapshot}:{page:BridgePage;pairing:RelayPairing|null;online:boolean;logs:BridgeLog[];onSnapshot:(s:BridgeSnapshot)=>void}){
  const [tab,setTab]=useState<PageDetailTab>('overview'),today=new Date().getDay(),todaySchedules=page.schedules.filter(s=>s.dayOfWeek===today).slice(0,4),remaining=page.progress?.remaining??page.groupCount,articles=Math.max(0,page.targetSlotsThisTurn||page.postsPerAccount),pageLogs=logs.filter(l=>l.pageTabId===page.pageTabId)
  return <div className="screen-content detail-screen"><section className="page-detail-head"><Avatar page={page} size="lg"/><div><strong>{page.name}</strong><span>UID: {page.pageUid}</span><em className={`status-pill status-pill--${tone(page.runtimeStatus)}`}><i/>{STATUS_LABELS[page.runtimeStatus]}</em></div><span className="page-detail-settings"><Icon name="settings" size={21}/></span></section>
    <div className="detail-tabs">{([['overview','Tổng quan'],['schedule','Lịch chạy'],['groups',`Nhóm (${page.groupCount})`],['logs','Log']] as [PageDetailTab,string][]).map(([key,label])=><button key={key} className={tab===key?'is-active':undefined} onClick={()=>setTab(key)}>{label}</button>)}</div>
    {tab==='overview'&&<><section className="detail-stats"><div><span className="detail-stat-icon">▣</span><strong>{page.today.success}</strong><small>Đã đăng hôm nay</small></div><div><span className="detail-stat-icon detail-stat-icon--yellow"><Icon name="clock" size={17}/></span><strong>{remaining}</strong><small>Còn lại hôm nay</small></div><div><span className="detail-stat-icon"><Icon name="users" size={18}/></span><strong>{page.groupCount}</strong><small>Tổng nhóm</small></div></section>
      <section className="detail-section control-section"><h2>Điều khiển</h2><GroupPostRemoteControl page={page} pairing={pairing} online={online} onSnapshot={onSnapshot}/></section>
      <section className="detail-section"><div className="section-title"><h2>Lịch chạy hôm nay</h2><span className="section-link">+ Thêm khung giờ</span></div><div className="detail-schedule-list">{todaySchedules.map((s,i)=><ScheduleRow key={`${s.startMinute}-${i}`} schedule={s} articles={articles}/>)}{!todaySchedules.length&&<div className="empty-inline">Chưa cấu hình lịch chạy hôm nay.</div>}</div></section>
      <section className="detail-section current-post-section"><h2>Bài viết hiện tại</h2>{page.currentPost?<div className="current-post-card"><span className="post-thumbnail"><Icon name="image" size={26}/></span><div><strong>{page.currentPost.contentPreview||`Bài #${page.currentPost.postIndex+1}`}</strong><small>{page.currentPost.contentLength?`${page.currentPost.contentLength} ký tự`:'Bài viết không có text'}</small><em><Icon name="image" size={13}/> {page.currentPost.imageCount} ảnh</em></div><Icon name="chevron" size={19}/></div>:<div className="empty-inline">Chưa có bài viết đang xử lý.</div>}</section></>}
    {tab==='schedule'&&<section className="detail-section tab-panel-section"><div className="section-title"><h2>Lịch chạy</h2><span>{page.schedules.length} khung giờ</span></div><div className="detail-schedule-list">{page.schedules.map((s,i)=><div className="schedule-with-day" key={`${s.dayOfWeek}-${s.startMinute}-${i}`}><span>{DAY_LABELS[s.dayOfWeek]??'?'}</span><ScheduleRow schedule={s} articles={articles}/></div>)}{!page.schedules.length&&<div className="empty-inline">Chưa cấu hình lịch chạy.</div>}</div></section>}
    {tab==='groups'&&<section className="detail-section tab-panel-section group-summary-panel"><div className="group-summary-card"><span><Icon name="users"/></span><div><strong>{page.groupCount} nhóm nguồn</strong><small>Danh sách Group gốc của Page Tab</small></div></div><div className="group-summary-card"><span><Icon name="play"/></span><div><strong>{page.currentGroupUid||'Chưa vào Group'}</strong><small>Group hiện tại</small></div></div><div className="group-progress"><span>Tiến độ phiên</span><strong>{page.progress?`${page.progress.success}/${page.progress.total}`:'—'}</strong><div><i style={{width:`${Math.max(0,Math.min(100,page.progress?.percent??0))}%`}}/></div></div></section>}
    {tab==='logs'&&<section className="detail-section tab-panel-section"><Logs logs={pageLogs}/></section>}
  </div>
}

function startWeek(d:Date){const r=new Date(d),day=r.getDay();r.setDate(r.getDate()+(day===0?-6:1-day));r.setHours(0,0,0,0);return r}
function sameDay(a:Date,b:Date){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
export function ScheduleScreen({pages,onSelectPage}:{pages:BridgePage[];onSelectPage:(p:BridgePage)=>void}){
  const [selected,setSelected]=useState(()=>new Date()),start=startWeek(selected),week=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d}),rows=pages.flatMap(page=>page.schedules.filter(s=>s.dayOfWeek===selected.getDay()).map(schedule=>({page,schedule}))).sort((a,b)=>a.schedule.startMinute-b.schedule.startMinute)
  return <div className="screen-content schedule-screen"><section className="calendar-head"><div className="calendar-head__title"><strong>Tháng {selected.getMonth()+1}, {selected.getFullYear()}</strong><button type="button" onClick={()=>{const d=new Date(selected);d.setDate(d.getDate()-7);setSelected(d)}}><Icon name="back" size={18}/></button><button type="button" className="today-button" onClick={()=>setSelected(new Date())}>Hôm nay</button></div><div className="week-strip">{week.map((d,i)=><button type="button" key={d.toISOString()} className={sameDay(d,selected)?'is-active':undefined} onClick={()=>setSelected(d)}><span>{WEEK_LABELS[i]}</span><strong>{d.getDate()}</strong></button>)}</div></section>
    <section className="schedule-day-section"><h2>Lịch chạy trong ngày</h2><div className="day-schedule-list">{rows.map(({page,schedule},i)=>{const s=scheduleState(schedule.status),articles=Math.max(0,page.targetSlotsThisTurn||page.postsPerAccount);return <button className="day-schedule-row" key={`${page.pageTabId}-${schedule.startMinute}-${i}`} onClick={()=>onSelectPage(page)}><time>{fmtMinute(schedule.startMinute)}</time><Avatar page={page} size="sm"/><span className="day-schedule-row__main"><strong>{page.name}</strong><small className={`schedule-state schedule-state--${s.tone}`}><i/>{s.label}</small></span><span className="day-schedule-row__count">{articles} bài</span><Icon name="chevron" size={18}/></button>})}{!rows.length&&<div className="empty-inline empty-inline--large">Không có lịch chạy trong ngày đã chọn.</div>}</div><div className="schedule-info"><Icon name="clock" size={26}/><p>Lịch chạy được thực hiện trên máy tính.<br/>Ứng dụng PWA chỉ hiển thị và cho phép thao tác cơ bản.</p></div></section>
  </div>
}
