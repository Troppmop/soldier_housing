import React, { useEffect, useState } from 'react'
import { getNotifications, markNotificationRead } from '../api'

export default function Notifications(){
  const [notes, setNotes] = useState([])

  useEffect(()=>{ fetchNotes() },[])
  async function fetchNotes(){
    try{ const r = await getNotifications(); setNotes(r.data) }catch(e){ console.error(e) }
  }

  const safeNotes = Array.isArray(notes) ? notes : []

  async function mark(id){
    try{ await markNotificationRead(id); fetchNotes() }catch(e){ console.error(e) }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-xl font-semibold mb-3">Notifications</h2>
      <div className="space-y-2">
        {safeNotes.map(n=> (
          <div key={n.id} className={`p-3 rounded ${n.is_read? 'bg-white': 'bg-emerald-50'}`}>
            <div className="flex justify-between items-start">
              <div>{n.message}</div>
              <div className="text-xs text-slate-400">{n.created_at}</div>
            </div>
            {!n.is_read && <div className="mt-2 text-right"><button onClick={()=>mark(n.id)} className="text-emerald-700">Mark read</button></div>}
          </div>
        ))}
      </div>
      {!notes.length && <div className="text-slate-500">No notifications.</div>}
    </div>
  )
}
