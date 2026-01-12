import React, { useEffect, useState } from 'react'
import { ownerApplications, acceptApplication } from '../api'

export default function Applications(){
  const [data, setData] = useState([])

  useEffect(()=>{ fetchList() },[])
  async function fetchList(){
    try{
      const resp = await ownerApplications()
      setData(resp.data)
    }catch(e){ console.error(e); alert('Failed to load') }
  }

  async function accept(id){
    try{
      await acceptApplication(id)
      alert('Accepted — phone numbers will be shared')
      fetchList()
    }catch(e){ alert('Accept failed') }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Applications</h2>
      {Array.isArray(data) ? data.map(group=> (
        <div key={group.apartment.id} className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold">{group.apartment.title}</h3>
          <div className="mt-3 space-y-2">
            {(Array.isArray(group.applications) ? group.applications : []).map(a=> (
              <div key={a.id} className="flex justify-between items-start bg-slate-50 p-3 rounded">
                <div>
                  <div className="font-medium">{a.applicant_name || `user#${a.applicant_id}`}</div>
                  <div className="text-sm text-slate-500">{a.message}</div>
                  <div className="text-xs text-slate-400">Status: {a.status}</div>
                  {a.applicant_phone && <div className="text-sm mt-1">Phone: {a.applicant_phone}</div>}
                </div>
                <div>
                  {a.status !== 'accepted' && <button onClick={()=>accept(a.id)} className="bg-emerald-700 text-white px-3 py-1 rounded">Accept</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!data.length && <div className="text-slate-500">No applications yet.</div>}
    </div>
  )
}
