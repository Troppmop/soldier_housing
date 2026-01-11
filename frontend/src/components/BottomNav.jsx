import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function BottomNav(){
  const loc = useLocation()
  const { user } = useAuth()
  const active = (p)=> loc.pathname === p ? 'text-emerald-700' : 'text-slate-500'
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t py-2 safe-area">
      <div className="max-w-xl mx-auto flex justify-between px-6">
        <Link to="/" className={`flex flex-col items-center ${active('/')}`}>
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </Link>
        <Link to="/create" className={`flex flex-col items-center ${active('/create')}`}>
          <span className="text-xl">➕</span>
          <span className="text-xs">Post</span>
        </Link>
        <Link to="/applications" className={`flex flex-col items-center ${active('/applications')}`}>
          <span className="text-xl">📬</span>
          <span className="text-xs">Apps</span>
        </Link>
        <Link to="/notifications" className={`flex flex-col items-center ${active('/notifications')}`}>
          <span className="text-xl">🔔</span>
          <span className="text-xs">Notes</span>
        </Link>
        {user && user.is_admin && (
          <Link to="/admin" className={`flex flex-col items-center ${active('/admin')}`}>
            <span className="text-xl">⚙️</span>
            <span className="text-xs">Admin</span>
          </Link>
        )}
        <Link to="/profile" className={`flex flex-col items-center ${active('/profile')}`}>
          <span className="text-xl">👤</span>
          <span className="text-xs">Account</span>
        </Link>
      </div>
    </nav>
  )
} 
