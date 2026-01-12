import React, {useEffect, useState} from 'react'
import { listApartments, applyApartment, getApartmentsApplied } from '../api'
import { useAuth } from '../AuthContext'
import Modal from '../components/Modal'

function SkeletonCard(){
  const list = Array.isArray(apartments) ? apartments : []

  return (
    <div className="bg-white p-4 rounded-xl shadow-md animate-pulse">
      <div className="h-6 bg-slate-200 rounded mb-3 w-3/4" />
      <div className="h-4 bg-slate-200 rounded mb-2 w-1/2" />
      <div className="h-20 bg-slate-200 rounded" />
    </div>
  )
}

export default function Apartments(){
  const [apartments, setApartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
    const [appliedMap, setAppliedMap] = useState({})
  const { user } = useAuth()

  useEffect(()=>{
    fetchList()
  },[])
  async function fetchList(){
    setLoading(true)
    try{
      const data = await listApartments()
      setApartments(data)
    }catch(e){
      console.error(e)
    }finally{
      setLoading(false)
    }
  }

  async function submitApply(){
    if(!selected) return
    try{
      await applyApartment(selected.id, message)
      alert('Applied — owner will be notified')
      setSelected(null)
        setMessage('')
        setAppliedMap(prev=>({ ...prev, [selected.id]: true }))
    }catch(e){
      alert('You must login to apply')
    }
  }
  
  useEffect(()=>{
    async function fetchApplied(){
      if(!user) return
      try{
        const ids = Array.isArray(apartments) ? apartments.map(a=>a.id) : []
        if(!ids.length) return
        const r = await getApartmentsApplied(ids)
        setAppliedMap(r.data.applied || {})
      }catch(e){ console.error(e) }
    }
    fetchApplied()
  },[apartments, user])

  return (
    <div className="pb-28">
      {loading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="grid gap-4">
          {list.map(a=> (
            <div key={a.id} className="bg-white p-4 rounded-xl shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{a.title}</h3>
                  <div className="text-sm text-slate-500">{a.location} • ${a.rent}/mo • {a.rooms} rooms</div>
                  <div className="text-xs text-slate-400 mt-1">Posted by: {a.owner_name ? a.owner_name : (a.owner_id ? `user#${a.owner_id}` : '—')}</div>
                </div>
                <div className="text-right">
                  {user && (user.id === a.owner_id || user.is_admin) ? (
                    <button disabled className="bg-slate-200 text-slate-500 px-4 py-2 rounded-lg">Your listing</button>
                  ) : appliedMap[a.id] ? (
                    <button disabled className="bg-slate-200 text-slate-500 px-4 py-2 rounded-lg">Applied</button>
                  ) : (
                    <button onClick={()=>setSelected(a)} className="bg-emerald-700 text-white px-4 py-2 rounded-lg">Apply</button>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-700">{a.description}</p>
            </div>
          ))}
          {!apartments.length && <div className="text-center text-slate-500">No apartments posted yet.</div>}
        </div>
      )}

      <Modal open={!!selected} title={selected?.title || "Apply"} onClose={()=>setSelected(null)}>
        <form onSubmit={(e)=>{ e.preventDefault(); submitApply(); }} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message to owner (optional)</label>
            <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Introduce yourself, availability, preferred move-in date, anything helpful." className="w-full p-3 border rounded min-h-[100px]" />
            <div className="text-xs text-slate-400 mt-1">Be concise — owners appreciate clarity.</div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={()=>setSelected(null)} className="px-4 py-2">Cancel</button>
            <button type="submit" className="bg-emerald-700 text-white px-4 py-2 rounded">Send Application</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
