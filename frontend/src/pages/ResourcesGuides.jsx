import React, { useEffect, useState } from 'react'
import { initApi, resourcesCreateItem, resourcesListItems, resourcesSaveItem, resourcesUnsaveItem } from '../api'

export default function ResourcesGuides(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')

  const category = 'Guide'

  async function refresh(){
    setLoading(true)
    try{
      await initApi()
      const resp = await resourcesListItems(category)
      setItems(Array.isArray(resp.data) ? resp.data : [])
    }catch(e){
      console.error(e)
      alert('Failed to load guides')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ refresh() },[])

  async function submit(e){
    e.preventDefault()
    const t = (title || '').trim()
    if(!t) return alert('Title is required')
    try{
      await initApi()
      await resourcesCreateItem({
        title: t,
        category,
        url: (url || '').trim() || null,
        description: (description || '').trim() || null,
      })
      setTitle('')
      setUrl('')
      setDescription('')
      await refresh()
      alert('Guide submitted (pending admin approval).')
    }catch(e){
      console.error(e)
      alert('Failed to submit guide')
    }
  }

  async function toggleSave(it){
    try{
      await initApi()
      if(it.is_saved) await resourcesUnsaveItem(it.id)
      else await resourcesSaveItem(it.id)
      await refresh()
    }catch(e){
      console.error(e)
      alert('Failed to update saved list')
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Guides</h2>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-medium">Submit a guide</h3>
        <div className="text-xs text-slate-500 mt-1">These appear here once approved.</div>
        <form onSubmit={submit} className="mt-2 space-y-2">
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Guide title" className="border rounded px-3 py-2 text-sm w-full" />
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="URL (optional)" className="border rounded px-3 py-2 text-sm w-full" />
          <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Summary (optional)" className="border rounded px-3 py-2 text-sm w-full h-24" />
          <div className="flex justify-end">
            <button className="text-sm px-3 py-2 bg-emerald-700 text-white rounded">Submit</button>
          </div>
        </form>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Approved guides</h3>
          <button onClick={refresh} className="text-sm px-3 py-1 bg-slate-100 rounded">Refresh</button>
        </div>

        {loading && <div className="text-sm text-slate-600">Loading…</div>}
        {!loading && items.length === 0 && <div className="text-sm text-slate-600">No guides yet.</div>}

        {items.map(it => (
          <div key={it.id} className="bg-white p-4 rounded shadow">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{it.title}</div>
              <button onClick={()=>toggleSave(it)} className={"text-sm px-3 py-1 rounded " + (it.is_saved ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700')}>
                {it.is_saved ? '★ Saved' : '☆ Save'}
              </button>
            </div>
            <div className="text-xs text-slate-500 mt-1">{it.status}</div>
            {it.url && <a className="text-sm text-emerald-700 underline break-all" href={it.url} target="_blank" rel="noreferrer">{it.url}</a>}
            {it.description && <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{it.description}</div>}
          </div>
        ))}
      </section>

      <div className="h-20" />
    </div>
  )
}
