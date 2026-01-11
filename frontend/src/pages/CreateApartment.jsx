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
      navigate('/')
    }catch(err){
      alert('You must login to post')
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-2">Post Apartment</h2>
      <form onSubmit={submit} className="space-y-3">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" className="w-full p-2 border rounded" />
        <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Location" className="w-full p-2 border rounded" />
        <input value={rooms} onChange={e=>setRooms(parseInt(e.target.value||1))} type="number" placeholder="Rooms" className="w-full p-2 border rounded" />
        <input value={rent} onChange={e=>setRent(parseInt(e.target.value||0))} type="number" placeholder="Rent" className="w-full p-2 border rounded" />
        <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description" className="w-full p-2 border rounded" />
        <div className="flex justify-end">
          <button className="bg-sky-600 text-white px-4 py-2 rounded">Post</button>
        </div>
      </form>
    </div>
  )
}
