import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createExternalListing, initApi } from '../api'

export default function CreateExternalListing(){
  const [source, setSource] = useState('yad2')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function submit(e){
    e.preventDefault()
    const u = (url || '').trim()
    if(!u){
      alert('URL is required')
      return
    }
    setBusy(true)
    try{
      await initApi()
      await createExternalListing({
        source,
        url: u,
        title: title.trim() ? title.trim() : null,
        price: price === '' ? null : Number(price),
        location: location.trim() ? location.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
      })
      alert('External listing submitted')
      navigate('/external')
    }catch(e2){
      const msg = e2?.response?.data?.detail
      alert(msg || 'Failed to submit')
    }finally{
      setBusy(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-lg mt-2">
      <h2 className="text-xl font-semibold mb-4 text-center">Submit External Listing</h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
          <select value={source} onChange={e=>setSource(e.target.value)} className="w-full p-3 border rounded-lg">
            <option value="yad2">Yad2</option>
            <option value="facebook">Facebook</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
          <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..." type="url" required className="w-full p-3 border rounded-lg" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Title (optional)</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="2BR in Jerusalem" className="w-full p-3 border rounded-lg" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Price (optional)</label>
          <input value={price} onChange={e=>setPrice(e.target.value)} placeholder="2500" inputMode="numeric" className="w-full p-3 border rounded-lg" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Location (optional)</label>
          <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Jerusalem" className="w-full p-3 border rounded-lg" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} className="w-full p-3 border rounded-lg" />
        </div>

        <button disabled={busy} className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-3 rounded-lg font-medium">
          {busy ? 'Submitting…' : 'Submit'}
        </button>
        <button type="button" onClick={()=>navigate('/external')} className="w-full text-sm text-slate-600 hover:underline">Back</button>
      </form>
    </div>
  )
}
