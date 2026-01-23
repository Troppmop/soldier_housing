import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../AuthContext'
import { useLocation } from 'react-router-dom'
import Modal from './Modal'
import { initApi, getNotifications, markNotificationRead } from '../api'

export default function Header(){
  const { user, logout } = useAuth()
  const loc = useLocation()
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifs, setNotifs] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)

  const unreadCount = useMemo(()=>{
    if(!Array.isArray(notifs)) return 0
    return notifs.filter(n=> n && n.is_read === false).length
  },[notifs])

  async function refreshNotifications(){
    if(!user) return
    setNotifLoading(true)
    try{
      await initApi()
      const resp = await getNotifications()
      setNotifs(Array.isArray(resp.data) ? resp.data : [])
    }catch(e){
      console.warn('getNotifications failed', e)
    }finally{
      setNotifLoading(false)
    }
  }

  async function markAllRead(){
    const unread = (Array.isArray(notifs) ? notifs : []).filter(n=> n && n.is_read === false)
    if(unread.length === 0) return
    try{
      await initApi()
      // best-effort; keep UI responsive
      await Promise.all(unread.map(n=> markNotificationRead(n.id).catch(()=>null)))
      setNotifs(prev => (Array.isArray(prev) ? prev.map(n=> n ? ({...n, is_read: true}) : n) : prev))
    }catch(e){
      console.warn('markAllRead failed', e)
    }
  }

  // Poll in the background while logged in so the badge updates
  useEffect(()=>{
    if(!user) {
      setNotifs([])
      return
    }
    let cancelled = false
    ;(async ()=>{
      if(cancelled) return
      await refreshNotifications()
    })()

    const t = setInterval(()=>{
      if(cancelled) return
      refreshNotifications()
    }, 30000)
    return ()=>{
      cancelled = true
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[user && user.id])

  // When opening the modal, refresh and mark unread as read
  useEffect(()=>{
    if(!notifOpen) return
    let mounted = true
    ;(async ()=>{
      await refreshNotifications()
      if(!mounted) return
      await markAllRead()
    })()
    return ()=>{ mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[notifOpen])
  const onAdminRefresh = ()=> {
    // emit a global event admin pages can listen to
    window.dispatchEvent(new CustomEvent('admin-refresh'))
  }
  return (
    <header className="p-3 bg-white border-b sticky top-0 z-20">
      <div className="max-w-xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">🏠 Lone Soldier Housing</div>
        </div>
        <div className="flex items-center gap-3">
          {loc.pathname.startsWith('/admin') && (
            <button onClick={onAdminRefresh} className="text-sm px-3 py-1 bg-emerald-50 text-emerald-700 rounded">Refresh</button>
          )}

          {user && (
            <button
              type="button"
              onClick={()=>setNotifOpen(true)}
              className="relative text-slate-700 hover:text-slate-900"
              aria-label="Open notifications"
              title="Notifications"
            >
              <span className="text-lg">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] leading-[18px] text-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {user && <div className="text-sm text-slate-700">{user.full_name || user.email}{user.is_admin && <span className="ml-2 text-emerald-700">(admin)</span>}</div>}
          {user && <button onClick={logout} className="text-sm text-red-600">Logout</button>}
        </div>
      </div>

      <Modal open={notifOpen} title="Notifications" onClose={()=>setNotifOpen(false)}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-slate-600">
            {notifLoading ? 'Loading…' : `${notifs.length} total`}
          </div>
          <button
            type="button"
            onClick={markAllRead}
            className="text-sm px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
            disabled={notifLoading || unreadCount === 0}
          >
            Mark all read
          </button>
        </div>

        {(!notifs || notifs.length === 0) ? (
          <div className="text-sm text-slate-600">No notifications yet.</div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
            {notifs.map(n => (
              <div key={n.id} className={
                "rounded-lg border p-3 " + (n.is_read ? "bg-white" : "bg-emerald-50 border-emerald-200")
              }>
                <div className="text-sm text-slate-900">{n.message}</div>
                <div className="text-xs text-slate-500 mt-1">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </header>
  )
}
