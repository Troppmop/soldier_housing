import React, { useEffect, useState } from 'react'
import { initApi, jobsSaved, jobsUnsave } from '../api'

export default function JobsSaved(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  async function refresh(){
    setLoading(true)
    try{
      await initApi()
      const resp = await jobsSaved()
      setItems(Array.isArray(resp.data) ? resp.data : [])
    }catch(e){
      console.error(e)
      alert('Failed to load saved jobs')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ refresh() },[])

  async function remove(j){
    try{
      await initApi()
      await jobsUnsave(j.id)
      await refresh()
    }catch(e){
      console.error(e)
      alert('Failed')
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Saved Jobs</h2>

      <section className="bg-white p-4 rounded shadow">
        <div className="font-medium">Search</div>
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Search saved jobs…"
          className="border rounded px-3 py-2 text-sm w-full mt-2"
        />
      </section>

      <div className="flex justify-end">
        <button onClick={refresh} className="text-sm px-3 py-1 bg-slate-100 rounded">Refresh</button>
      </div>

      {loading && <div className="text-sm text-slate-600">Loading…</div>}
      {!loading && items.length === 0 && <div className="text-sm text-slate-600">No saved jobs yet.</div>}

      {items
        .filter(j => {
          const s = (search || '').trim().toLowerCase()
          if(!s) return true
          const hay = `${j.title || ''} ${j.company || ''} ${j.location || ''} ${j.salary || ''} ${j.apply_url || ''}`.toLowerCase()
          return hay.includes(s)
        })
        .map(j => (
        <div key={j.id} className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{j.title}</div>
            <button onClick={()=>remove(j)} className="text-sm px-3 py-1 bg-slate-100 rounded">Remove</button>
          </div>
          <div className="text-xs text-slate-500 mt-1">{(j.company || 'Company') + (j.location ? ' • ' + j.location : '')}</div>
          {j.salary && <div className="text-sm text-slate-700 mt-2">Salary: {j.salary}</div>}
          {j.apply_url && <a className="text-sm text-emerald-700 underline break-all" href={j.apply_url} target="_blank" rel="noreferrer">{j.apply_url}</a>}
        </div>
      ))}

      <div className="h-20" />
    </div>
  )
}
