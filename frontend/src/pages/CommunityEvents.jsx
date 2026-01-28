import React, { useEffect, useState } from 'react'
import { initApi, communityCreateEvent, communityListEvents } from '../api'

function toLocalInputValue(dt){
  try{
    const d = new Date(dt)
    if(Number.isNaN(d.getTime())) return ''
    const pad = (n)=> String(n).padStart(2,'0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }catch(e){
    return ''
  }
}

export default function CommunityEvents(){
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [startsAt, setStartsAt] = useState(toLocalInputValue(new Date(Date.now() + 60*60*1000)))

  async function refresh(nextSearch){
    setLoading(true)
    try{
      await initApi()
      const s = typeof nextSearch === 'string' ? nextSearch : search
      const resp = await communityListEvents((s || '').trim() || undefined)
      setEvents(Array.isArray(resp.data) ? resp.data : [])
    }catch(e){
      console.error(e)
      alert('Failed to load events')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ refresh() },[])

  async function submit(e){
    e.preventDefault()
    const t = (title || '').trim()
    if(!t) return alert('Title is required')
    if(!startsAt) return alert('Start time is required')

    try{
      await initApi()
      await communityCreateEvent({
        title: t,
        description: (description || '').trim() || null,
        location: (location || '').trim() || null,
        starts_at: new Date(startsAt).toISOString(),
      })
      setTitle('')
      setDescription('')
      setLocation('')
      await refresh()
      alert('Event submitted (pending admin approval).')
    }catch(e){
      console.error(e)
      alert('Failed to submit event')
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Community Events</h2>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-medium">Search</h3>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e)=>{ e.preventDefault(); refresh() }}
        >
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Search events (title/location)…"
            className="border rounded px-3 py-2 text-sm flex-1"
          />
          <button type="submit" className="text-sm px-3 py-2 bg-slate-100 rounded">Search</button>
        </form>
        {(search || '').trim() && (
          <div className="mt-2">
            <button
              type="button"
              onClick={()=>{ setSearch(''); refresh('') }}
              className="text-xs px-2 py-1 bg-slate-100 rounded"
            >
              Clear
            </button>
          </div>
        )}
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-medium">Create event</h3>
        <div className="text-xs text-slate-500 mt-1">Events require admin approval before everyone sees them.</div>
        <form onSubmit={submit} className="mt-2 space-y-2">
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" className="border rounded px-3 py-2 text-sm w-full" />
          <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Location (optional)" className="border rounded px-3 py-2 text-sm w-full" />
          <input type="datetime-local" value={startsAt} onChange={e=>setStartsAt(e.target.value)} className="border rounded px-3 py-2 text-sm w-full" />
          <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description (optional)" className="border rounded px-3 py-2 text-sm w-full h-24" />
          <div className="flex justify-end">
            <button className="text-sm px-3 py-2 bg-emerald-700 text-white rounded">Submit</button>
          </div>
        </form>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Upcoming</h3>
          <button onClick={()=>refresh()} className="text-sm px-3 py-1 bg-slate-100 rounded">Refresh</button>
        </div>

        {loading && <div className="text-sm text-slate-600">Loading…</div>}
        {!loading && events.length === 0 && <div className="text-sm text-slate-600">No events yet.</div>}

        {events.map(ev => (
          <div key={ev.id} className="bg-white p-4 rounded shadow">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{ev.title}</div>
              <div className={"text-xs px-2 py-1 rounded " + (ev.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : ev.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>
                {ev.status}
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-1">By {ev.created_by_name || `user#${ev.created_by_user_id}`}</div>
            <div className="text-sm text-slate-800 mt-2">
              <div><span className="text-slate-500">When:</span> {ev.starts_at ? new Date(ev.starts_at).toLocaleString() : ''}</div>
              {ev.location && <div><span className="text-slate-500">Where:</span> {ev.location}</div>}
            </div>
            {ev.description && <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{ev.description}</div>}
          </div>
        ))}
      </section>

      <div className="h-20" />
    </div>
  )
}
