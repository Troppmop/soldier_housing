import React from 'react'
import { useAuth } from '../AuthContext'
import { useLocation } from 'react-router-dom'

export default function Header(){
  const { user, logout } = useAuth()
  const loc = useLocation()
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
          {user && <div className="text-sm text-slate-700">{user.full_name || user.email}{user.is_admin && <span className="ml-2 text-emerald-700">(admin)</span>}</div>}
          {user && <button onClick={logout} className="text-sm text-red-600">Logout</button>}
        </div>
      </div>
    </header>
  )
}
