import React, {useEffect, useState, useMemo} from 'react'
import { listApartments, applyApartment, getApartmentsApplied, deleteApartment } from '../api'
import { useAuth } from '../AuthContext'
import Modal from '../components/Modal'

function SkeletonCard(){
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
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('newest')
  const [filterType, setFilterType] = useState('all')
  const [filterGender, setFilterGender] = useState('all')
  const [filterShabbos, setFilterShabbos] = useState('any')
  const [filterKashrut, setFilterKashrut] = useState('any')
  const [filterOppositeGenderAllowed, setFilterOppositeGenderAllowed] = useState('any')
  const [filterSmokingAllowed, setFilterSmokingAllowed] = useState('any')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [selectedDetails, setSelectedDetails] = useState(null)
  const [message, setMessage] = useState('')
    const [appliedMap, setAppliedMap] = useState({})
  const { user } = useAuth()
  const formatGender = (g) => {
    if(!g) return 'Not specified'
    const s = String(g)
    return s ? (s.charAt(0).toUpperCase() + s.slice(1)) : 'Not specified'
  }

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
    // prevent applying to your own listing
    if(user && selected && (user.id === selected.owner_id || user.id === selected.ownerId)){
      alert('You cannot apply to your own listing')
      return
    }
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

  async function onDelete(apartment){
    if(!apartment) return
    if(!user) {
      alert('You must be logged in')
      return
    }
    if(!(user.id === apartment.owner_id || user.id === apartment.ownerId || user.is_admin)){
      alert('Not authorized')
      return
    }
    if(!confirm('Delete this listing? This cannot be undone.')) return
    try{
      await deleteApartment(apartment.id)
      setApartments(prev => (Array.isArray(prev) ? prev.filter(a => a.id !== apartment.id) : []))
      setAppliedMap(prev => {
        const next = { ...(prev || {}) }
        delete next[apartment.id]
        return next
      })
    }catch(e){
      console.error(e)
      alert('Delete failed')
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

  const list = useMemo(()=>{
    let out = Array.isArray(apartments) ? apartments.slice() : []
    const q = (query || '').trim().toLowerCase()
    if(q){
      out = out.filter(a => {
        return (a.title||'').toLowerCase().includes(q) || (a.location||'').toLowerCase().includes(q) || (a.description||'').toLowerCase().includes(q)
      })
    }
    if(filterType === 'offer') out = out.filter(a=>a.listing_type !== 'seeking')
    if(filterType === 'seeking') out = out.filter(a=>a.listing_type === 'seeking')

    if(filterGender !== 'all'){
      out = out.filter(a => (a.gender || '').toLowerCase() === filterGender)
    }

    if(filterShabbos !== 'any'){
      out = out.filter(a => !!a.shomer_shabbos === (filterShabbos === 'yes'))
    }
    if(filterKashrut !== 'any'){
      out = out.filter(a => !!a.shomer_kashrut === (filterKashrut === 'yes'))
    }
    if(filterOppositeGenderAllowed !== 'any'){
      out = out.filter(a => !!a.opposite_gender_allowed === (filterOppositeGenderAllowed === 'yes'))
    }
    if(filterSmokingAllowed !== 'any'){
      out = out.filter(a => !!a.smoking_allowed === (filterSmokingAllowed === 'yes'))
    }

    if(sort === 'rent-asc') out.sort((x,y)=> (x.rent||0) - (y.rent||0))
    else if(sort === 'rent-desc') out.sort((x,y)=> (y.rent||0) - (x.rent||0))
    else out.sort((x,y)=> (y.id||0) - (x.id||0)) // newest by id desc

    return out
  }, [apartments, query, sort, filterType, filterGender, filterShabbos, filterKashrut, filterOppositeGenderAllowed, filterSmokingAllowed])

  const emptyMessage = !apartments.length ? 'No apartments posted yet.' : (list.length === 0 ? 'No listings match your search or filters.' : null)

  return (
    <div className="pb-28 px-3 max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold">Listings</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <input
            placeholder="Search title, location or description"
            value={query}
            onChange={e=>setQuery(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-full sm:w-72"
          />
          <select value={sort} onChange={e=>setSort(e.target.value)} className="border rounded px-2 py-2 text-sm w-full sm:w-auto">
            <option value="newest">Newest</option>
            <option value="rent-asc">Rent: Low → High</option>
            <option value="rent-desc">Rent: High → Low</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={()=>setFilterType('all')} className={`px-3 py-1 rounded ${filterType==='all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 border'}`}>All</button>
        <button onClick={()=>setFilterType('offer')} className={`px-3 py-1 rounded ${filterType==='offer' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 border'}`}>Offers</button>
        <button onClick={()=>setFilterType('seeking')} className={`px-3 py-1 rounded ${filterType==='seeking' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 border'}`}>Seeking</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <select value={filterGender} onChange={e=>setFilterGender(e.target.value)} className="border rounded px-2 py-2 text-sm">
          <option value="all">Gender: Any</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <select value={filterShabbos} onChange={e=>setFilterShabbos(e.target.value)} className="border rounded px-2 py-2 text-sm">
          <option value="any">Shabbos: Any</option>
          <option value="yes">Shabbos: Yes</option>
          <option value="no">Shabbos: No</option>
        </select>
        <select value={filterKashrut} onChange={e=>setFilterKashrut(e.target.value)} className="border rounded px-2 py-2 text-sm">
          <option value="any">Kashrut: Any</option>
          <option value="yes">Kashrut: Yes</option>
          <option value="no">Kashrut: No</option>
        </select>
        <select value={filterOppositeGenderAllowed} onChange={e=>setFilterOppositeGenderAllowed(e.target.value)} className="border rounded px-2 py-2 text-sm">
          <option value="any">Opp. gender: Any</option>
          <option value="yes">Opp. gender: Allowed</option>
          <option value="no">Opp. gender: Not allowed</option>
        </select>
        <select value={filterSmokingAllowed} onChange={e=>setFilterSmokingAllowed(e.target.value)} className="border rounded px-2 py-2 text-sm">
          <option value="any">Smoking: Any</option>
          <option value="yes">Smoking: Allowed</option>
          <option value="no">Smoking: Not allowed</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="space-y-3">
          {emptyMessage ? (
            <div className="text-slate-500">{emptyMessage}</div>
          ) : (
            list.map(a => (
              <div key={a.id} className="bg-white p-4 rounded shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-lg">{a.title}</div>
                    <div className="text-sm text-slate-500">
                      {a.location}
                      {` • ${formatGender(a.gender)}`}
                      {a.rooms ? ` • ${a.rooms} rooms` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">{a.rent ? `₪${a.rent}` : '—'}</div>
                    <div className="text-xs mt-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700">{a.listing_type || 'offer'}</div>
                  </div>
                </div>
                <div className="text-sm text-slate-600 mt-2">{(a.description || '').slice(0,200)}{(a.description||'').length>200 ? '…' : ''}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">Gender: {formatGender(a.gender)}</span>
                  {a.shomer_shabbos ? <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">Shomer Shabbos</span> : null}
                  {a.shomer_kashrut ? <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">Shomer Kashrut</span> : null}
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">Opp. gender: {a.opposite_gender_allowed ? 'Allowed' : 'Not allowed'}</span>
                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">Smoking: {a.smoking_allowed ? 'Allowed' : 'Not allowed'}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-slate-400">Posted #{a.id}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>setSelectedDetails(a)} className="px-3 py-2 border rounded text-sm">Details</button>
                    {appliedMap[a.id] ? (
                      <div className="text-emerald-700 text-sm">Applied</div>
                    ) : (user && (user.id === a.owner_id || user.id === a.ownerId) ? (
                      <div className="flex items-center gap-2">
                        <div className="text-slate-500 text-sm">Your listing</div>
                        <button onClick={()=>onDelete(a)} className="text-red-600 text-sm hover:underline">Delete</button>
                      </div>
                    ) : (
                      <button onClick={()=>{ setSelected(a); setMessage('') }} className="bg-emerald-700 text-white px-3 py-2 rounded">Apply</button>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Modal open={!!selected} title={selected ? `Apply to ${selected.title}` : ''} onClose={()=>{ setSelected(null); setMessage('') }}>
        <div>
          <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Message to owner (optional)" className="w-full border rounded p-2 h-24" />
          <div className="flex flex-col sm:flex-row justify-end gap-2 mt-3">
            <button onClick={()=>{ setSelected(null); setMessage('') }} className="px-3 py-2 border rounded">Cancel</button>
            <button onClick={submitApply} className="px-3 py-2 bg-emerald-700 text-white rounded">Send Application</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!selectedDetails} title={selectedDetails ? selectedDetails.title : ''} onClose={()=>setSelectedDetails(null)}>
        {selectedDetails && (
          <div className="space-y-3">
            <div className="text-sm text-slate-500">{selectedDetails.location || ''}</div>
            <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">Gender: {formatGender(selectedDetails.gender)}</span>
              {selectedDetails.shomer_shabbos ? <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">Shomer Shabbos</span> : null}
              {selectedDetails.shomer_kashrut ? <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">Shomer Kashrut</span> : null}
              <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">Opp. gender: {selectedDetails.opposite_gender_allowed ? 'Allowed' : 'Not allowed'}</span>
              <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">Smoking: {selectedDetails.smoking_allowed ? 'Allowed' : 'Not allowed'}</span>
            </div>
            <div className="text-sm">
              <div className="font-medium mb-1">Details</div>
              <div className="whitespace-pre-wrap text-slate-700">{selectedDetails.description || ''}</div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setSelectedDetails(null)} className="px-3 py-2 border rounded">Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
