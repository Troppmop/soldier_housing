import React, {useState} from 'react'
import { createApartment } from '../api'
import { useNavigate } from 'react-router-dom'

export default function CreateApartment(){
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [location, setLocation] = useState('')
  const [rooms, setRooms] = useState(1)
  const [rent, setRent] = useState(0)
  const navigate = useNavigate()

  async function submit(e){
    e.preventDefault()
    try{
      await createApartment({ title, description: desc, location, rooms, rent })
      alert('Posted')
      // force a full reload so the apartments list refreshes reliably after deploy
      window.location.href = '/'
    }catch(err){
      alert('You must login to post')
    }
  }

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-xl shadow-lg mt-4">
      <h2 className="text-xl font-semibold mb-4">Post Apartment</h2>
      <form onSubmit={submit} className="space-y-4" aria-label="Create apartment form">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
          <input
            value={title}
            onChange={e=>setTitle(e.target.value)}
            placeholder="Short headline, e.g. 'Cozy 1BR near base'"
            className="w-full p-3 border rounded-lg"
            aria-required="true"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
          <input
            value={location}
            onChange={e=>setLocation(e.target.value)}
            placeholder="Neighborhood, city or nearby landmark"
            className="w-full p-3 border rounded-lg"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rooms</label>
            <input
              value={rooms}
              onChange={e=>setRooms(Math.max(1, parseInt(e.target.value||1)))}
              type="number"
              min="1"
              className="w-full p-3 border rounded-lg"
              aria-label="Number of rooms"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rent (₪)</label>
            <input
              value={rent}
              onChange={e=>setRent(Math.max(0, parseInt(e.target.value||0)))}
              type="number"
              min="0"
              className="w-full p-3 border rounded-lg"
              aria-label="Monthly rent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea
            value={desc}
            onChange={e=>setDesc(e.target.value)}
            placeholder="Add details: utilities, pets, available from, contact preferences, photos URL..."
            className="w-full p-3 border rounded-lg min-h-[120px]"
          />
        </div>

        <div className="flex justify-end">
          <button type="submit" className="bg-emerald-700 text-white px-4 py-2 rounded-lg">Post Apartment</button>
        </div>
      </form>
    </div>
  )
}
