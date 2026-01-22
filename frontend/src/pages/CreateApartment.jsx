import React, {useState} from 'react'
import { createApartment } from '../api'
import { useNavigate } from 'react-router-dom'

export default function CreateApartment(){
  const [listingType, setListingType] = useState('offer')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [location, setLocation] = useState('')
  const [rooms, setRooms] = useState(1)
  const [rent, setRent] = useState(0)
  const [gender, setGender] = useState('')
  const [shomerShabbos, setShomerShabbos] = useState(false)
  const [shomerKashrut, setShomerKashrut] = useState(false)
  const [oppositeGenderAllowed, setOppositeGenderAllowed] = useState(false)
  const [smokingAllowed, setSmokingAllowed] = useState(false)
  const navigate = useNavigate()

  async function submit(e){
    e.preventDefault()
    if(!gender){
      alert('Please select a gender')
      return
    }
    try{
      await createApartment({
        title,
        description: desc,
        location,
        rooms,
        rent,
        listing_type: listingType,
        gender,
        shomer_shabbos: !!shomerShabbos,
        shomer_kashrut: !!shomerKashrut,
        opposite_gender_allowed: !!oppositeGenderAllowed,
        smoking_allowed: !!smokingAllowed,
      })
      alert('Posted')
      // force a full reload so the apartments list refreshes reliably after deploy
      window.location.href = '/'
    }catch(err){
      alert('You must login to post')
    }
  }

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-xl shadow-lg mt-4">
      <h2 className="text-xl font-semibold mb-4">{listingType === 'offer' ? 'Post Apartment' : 'Post Looking-for Listing'}</h2>
      <div className="flex gap-2 mb-4">
        <button type="button" onClick={() => setListingType('offer')} className={`px-3 py-1 rounded-lg ${listingType==='offer' ? 'bg-emerald-700 text-white' : 'bg-slate-100'}`}>Posting an apartment</button>
        <button type="button" onClick={() => setListingType('seeking')} className={`px-3 py-1 rounded-lg ${listingType==='seeking' ? 'bg-emerald-700 text-white' : 'bg-slate-100'}`}>Looking for apartment</button>
      </div>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
            <select value={gender} onChange={e=>setGender(e.target.value)} className="w-full p-3 border rounded-lg" required>
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-7">
            <input id="oppositeGenderAllowed" type="checkbox" checked={oppositeGenderAllowed} onChange={e=>setOppositeGenderAllowed(e.target.checked)} />
            <label htmlFor="oppositeGenderAllowed" className="text-sm text-slate-700">Opposite gender allowed</label>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <input id="shomerShabbos" type="checkbox" checked={shomerShabbos} onChange={e=>setShomerShabbos(e.target.checked)} />
            <label htmlFor="shomerShabbos" className="text-sm text-slate-700">Shomer Shabbos</label>
          </div>
          <div className="flex items-center gap-2">
            <input id="shomerKashrut" type="checkbox" checked={shomerKashrut} onChange={e=>setShomerKashrut(e.target.checked)} />
            <label htmlFor="shomerKashrut" className="text-sm text-slate-700">Shomer Kashrut</label>
          </div>
          <div className="flex items-center gap-2">
            <input id="smokingAllowed" type="checkbox" checked={smokingAllowed} onChange={e=>setSmokingAllowed(e.target.checked)} />
            <label htmlFor="smokingAllowed" className="text-sm text-slate-700">Smoking allowed</label>
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
          <button type="submit" className="bg-emerald-700 text-white px-4 py-2 rounded-lg">{listingType === 'offer' ? 'Post Apartment' : 'Post Listing'}</button>
        </div>
      </form>
    </div>
  )
}
