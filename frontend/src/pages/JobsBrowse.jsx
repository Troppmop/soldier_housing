import React, { useEffect, useState } from 'react'
import { initApi, jobsApply, jobsList, jobsSave, jobsUnsave } from '../api'
import { useAuth } from '../AuthContext'

export default function JobsBrowse(){
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const [search, setSearch] = useState('')

  async function refresh(nextSearch){
    setLoading(true)
    try{
      await initApi()
      const s = typeof nextSearch === 'string' ? nextSearch : search
      const resp = await jobsList((s || '').trim() || undefined)
      setItems(Array.isArray(resp.data) ? resp.data : [])
    }catch(e){
      console.error(e)
      alert('Failed to load jobs')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ refresh() },[])

  async function toggleSave(j){
    try{
      await initApi()
      if(j.is_saved) await jobsUnsave(j.id)
      else await jobsSave(j.id)
      await refresh()
    }catch(e){
      console.error(e)
      alert('Failed to update saved list')
    }
  }

  async function apply(j){
    const msg = window.prompt('Optional message to the poster:', '')
    try{
      await initApi()
      await jobsApply(j.id, { message: msg || null })
      alert('Applied')
    }catch(e){
      console.error(e)
      const detail = e && e.response && e.response.data && e.response.data.detail
      alert(detail || 'Apply failed')
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Jobs</h2>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-medium">Search</h3>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e)=>{ e.preventDefault(); refresh() }}
        >
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Search jobs (title/company/location)…"
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

      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-600">Browse approved listings (your pending listings are visible to you).</div>
        <button onClick={()=>refresh()} className="text-sm px-3 py-1 bg-slate-100 rounded">Refresh</button>
      </div>

      {loading && <div className="text-sm text-slate-600">Loading…</div>}
      {!loading && items.length === 0 && <div className="text-sm text-slate-600">No job listings yet.</div>}

      {items.map(j => (
        <div key={j.id} className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{j.title}</div>
            <button onClick={()=>toggleSave(j)} className={"text-sm px-3 py-1 rounded " + (j.is_saved ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700')}>
              {j.is_saved ? '★ Saved' : '☆ Save'}
            </button>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {(j.company || 'Company') + (j.location ? ' • ' + j.location : '')}
            {' • '}{j.status}
          </div>
          <div className="text-xs text-slate-500 mt-1">Posted by {j.created_by_name || `user#${j.created_by_user_id}`}</div>
          {j.salary && <div className="text-sm text-slate-700 mt-2">Salary: {j.salary}</div>}
          {j.description && <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{j.description}</div>}
          {j.apply_url && <a className="text-sm text-emerald-700 underline break-all" href={j.apply_url} target="_blank" rel="noreferrer">{j.apply_url}</a>}

          <div className="mt-3 flex gap-2">
            {user && Number(user.id) !== Number(j.created_by_user_id) && (
              <button onClick={()=>apply(j)} className="text-sm px-3 py-2 bg-emerald-700 text-white rounded">Apply</button>
            )}
            {user && Number(user.id) === Number(j.created_by_user_id) && (
              <div className="text-sm text-slate-600 flex items-center">Your listing</div>
            )}
          </div>
        </div>
      ))}

      <div className="h-20" />
    </div>
  )
}
