import React, { useEffect, useMemo, useState } from 'react'
import {
  addExternalInterest,
  createContactRequest,
  listExternalListings,
  removeExternalInterest,
} from '../api'
import { useAuth } from '../AuthContext'

function formatSource(s){
  const v = (s || '').toString().toLowerCase()
  if(v === 'yad2') return 'Yad2'
  if(v === 'facebook') return 'Facebook'
  if(v === 'other') return 'Other'
  return s || 'Other'
}

export default function ExternalListings(){
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(()=>{
    fetchList()
  },[])

  async function fetchList(nextSearch){
    setLoading(true)
    try{
      const s = typeof nextSearch === 'string' ? nextSearch : search
      const resp = await listExternalListings(0, 50, (s || '').trim() || undefined)
      const data = resp.data
      setItems(Array.isArray(data?.items) ? data.items : [])
    }catch(e){
      console.error(e)
      alert('Failed to load external listings')
    }finally{
      setLoading(false)
    }
  }

  const sorted = useMemo(()=>{
    return Array.isArray(items) ? items : []
  },[items])

  async function toggleInterest(listing){
    if(!listing) return
    if(!user){
      alert('Please log in')
      return
    }
    const id = listing.id
    setBusyId(id)
    // optimistic update
    setItems(prev => prev.map(x => {
      if(x.id !== id) return x
      const was = !!x.is_interested
      const nextInterested = !was
      const nextCount = Math.max(0, (x.interest_count || 0) + (nextInterested ? 1 : -1))
      return { ...x, is_interested: nextInterested, interest_count: nextCount }
    }))

    try{
      if(listing.is_interested){
        // it was interested before our optimistic flip
        const resp = await removeExternalInterest(id)
        const c = resp?.data?.interest_count
        if(typeof c === 'number') setItems(prev => prev.map(x => x.id === id ? ({...x, interest_count: c, is_interested: false}) : x))
      }else{
        const resp = await addExternalInterest(id)
        const c = resp?.data?.interest_count
        if(typeof c === 'number') setItems(prev => prev.map(x => x.id === id ? ({...x, interest_count: c, is_interested: true}) : x))
      }
    }catch(e){
      // revert optimistic
      setItems(prev => prev.map(x => {
        if(x.id !== id) return x
        const was = !!listing.is_interested
        return { ...x, is_interested: was, interest_count: listing.interest_count }
      }))
      alert('Could not update interest')
    }finally{
      setBusyId(null)
    }
  }

  async function requestContact(listing){
    if(!listing) return
    if(!user){
      alert('Please log in')
      return
    }
    if(user.id === listing.created_by_user_id){
      alert('This is your listing')
      return
    }
    try{
      await createContactRequest({ listing_id: listing.id, target_user_id: listing.created_by_user_id })
      alert('Contact request sent. If accepted, you will be able to view phone numbers by mutual consent.')
    }catch(e){
      const msg = e?.response?.data?.detail
      alert(msg || 'Could not request contact exchange')
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">External Listings</h2>
        <a href="/external/new" className="text-sm px-3 py-2 rounded-lg bg-emerald-700 text-white">Create External Listing</a>
      </div>

      <p className="text-sm text-slate-600">User-submitted links only. No scraping.</p>

      <section className="bg-white p-4 rounded-xl border">
        <div className="font-medium">Search</div>
        <form className="mt-2 flex gap-2" onSubmit={(e)=>{ e.preventDefault(); fetchList() }}>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Search (title/url/location/notes)…"
            className="border rounded px-3 py-2 text-sm flex-1"
          />
          <button type="submit" className="text-sm px-3 py-2 bg-slate-100 rounded">Search</button>
        </form>
        {(search || '').trim() && (
          <div className="mt-2">
            <button
              type="button"
              onClick={()=>{ setSearch(''); fetchList('') }}
              className="text-xs px-2 py-1 bg-slate-100 rounded"
            >
              Clear
            </button>
          </div>
        )}
      </section>

      {loading ? (
        <div className="text-slate-600">Loading…</div>
      ) : (
        <div className="grid gap-3">
          {sorted.length === 0 && (
            <div className="bg-white p-4 rounded-xl border text-slate-600">No external listings yet.</div>
          )}

          {sorted.map(l => (
            <div key={l.id} className="bg-white p-4 rounded-xl shadow-sm border">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-500">{formatSource(l.source)}</div>
                  <div className="font-semibold text-slate-900">
                    {l.title ? l.title : (l.url || 'Link')}
                  </div>
                  {l.title && l.url && (
                    <a className="text-sm text-emerald-700 break-all" href={l.url} target="_blank" rel="noreferrer">{l.url}</a>
                  )}
                  {!l.title && l.url && (
                    <a className="text-sm text-emerald-700 break-all" href={l.url} target="_blank" rel="noreferrer">Open link</a>
                  )}
                  <div className="text-sm text-slate-600 mt-2">
                    {l.location ? <span>{l.location}</span> : null}
                    {(l.location && l.price != null) ? <span> · </span> : null}
                    {l.price != null ? <span>${l.price}</span> : null}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">{(l.interest_count || 0)} people interested</div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    disabled={busyId === l.id}
                    onClick={()=>toggleInterest(l)}
                    className={
                      'text-sm px-3 py-2 rounded-lg border ' +
                      (l.is_interested ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-700')
                    }
                  >
                    {l.is_interested ? 'Interested' : 'Interested?'}
                  </button>

                  <button
                    onClick={()=>requestContact(l)}
                    className="text-sm px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800"
                  >
                    Request contact
                  </button>
                </div>
              </div>

              {l.notes && (
                <div className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">{l.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
