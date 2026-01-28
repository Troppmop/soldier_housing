import React, { useEffect, useState } from 'react'
import { initApi, resourcesSaved, resourcesUnsaveItem } from '../api'

export default function ResourcesSaved(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  async function refresh(){
    setLoading(true)
    try{
      await initApi()
      const resp = await resourcesSaved()
      setItems(Array.isArray(resp.data) ? resp.data : [])
    }catch(e){
      console.error(e)
      alert('Failed to load saved resources')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ refresh() },[])

  async function remove(it){
    try{
      await initApi()
      await resourcesUnsaveItem(it.id)
      await refresh()
    }catch(e){
      console.error(e)
      alert('Failed')
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Saved Resources</h2>

      <section className="bg-white p-4 rounded shadow">
        <div className="font-medium">Search</div>
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Search saved resources…"
          className="border rounded px-3 py-2 text-sm w-full mt-2"
        />
      </section>

      <div className="flex justify-end">
        <button onClick={refresh} className="text-sm px-3 py-1 bg-slate-100 rounded">Refresh</button>
      </div>

      {loading && <div className="text-sm text-slate-600">Loading…</div>}
      {!loading && items.length === 0 && <div className="text-sm text-slate-600">No saved resources yet.</div>}

      {items
        .filter(it => {
          const s = (search || '').trim().toLowerCase()
          if(!s) return true
          const hay = `${it.title || ''} ${it.description || ''} ${it.url || ''}`.toLowerCase()
          return hay.includes(s)
        })
        .map(it => (
        <div key={it.id} className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{it.title}</div>
            <button onClick={()=>remove(it)} className="text-sm px-3 py-1 bg-slate-100 rounded">Remove</button>
          </div>
          {it.url && <a className="text-sm text-emerald-700 underline break-all" href={it.url} target="_blank" rel="noreferrer">{it.url}</a>}
          {it.description && <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{it.description}</div>}
        </div>
      ))}

      <div className="h-20" />
    </div>
  )
}
