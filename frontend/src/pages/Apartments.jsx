import React, {useEffect, useState} from 'react'
import { listApartments, applyApartment } from '../api'

export default function Apartments(){
  const [apartments, setApartments] = useState([])

  useEffect(()=>{
    fetchList()
  },[])
  async function fetchList(){
    const data = await listApartments()
    setApartments(data)
  }

  async function apply(id){
    const msg = prompt('Message to owner (optional)')
    try{
      await applyApartment(id, msg)
      alert('Applied')
    }catch(e){
      alert('You must login to apply')
    }
  }

  return (
    <div className="space-y-4">
      {apartments.map(a=> (
        <div key={a.id} className="bg-white p-4 rounded shadow">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{a.title}</h3>
              <div className="text-sm text-slate-500">{a.location} • ${a.rent}/mo • {a.rooms} rooms</div>
            </div>
            <div className="text-right">
              <button onClick={()=>apply(a.id)} className="bg-sky-600 text-white px-3 py-1 rounded">Apply</button>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-700">{a.description}</p>
        </div>
      ))}
    </div>
  )
}
