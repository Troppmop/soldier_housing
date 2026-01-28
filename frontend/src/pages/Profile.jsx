import React, { useEffect, useState } from 'react'
import {
  acceptContactRequest,
  changePassword,
  declineContactRequest,
  getContactInfo,
  getCurrentUser,
  getMyPhone,
  listIncomingContactRequests,
  setMyPhone,
  updateProfile,
} from '../api'

export default function Profile(){
  const [user, setUser] = useState(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [incoming, setIncoming] = useState([])
  const [contactMap, setContactMap] = useState({})

  useEffect(()=>{ fetch() },[])
  async function fetch(){
    try{
      const u = await getCurrentUser()
      setUser(u)
      setFullName(u.full_name || '')
      // phone is private; load via dedicated endpoint
      try{
        const pr = await getMyPhone()
        setPhone(pr.data.phone_number || '')
        setPhoneVerified(!!pr.data.phone_verified)
      }catch(e2){
        setPhone('')
        setPhoneVerified(false)
      }

      try{
        const ir = await listIncomingContactRequests()
        setIncoming(Array.isArray(ir.data) ? ir.data : [])
      }catch(e3){
        setIncoming([])
      }
    }catch(e){ console.error(e) }
  }

  async function saveProfile(e){
    e.preventDefault()
    try{
      await updateProfile({ full_name: fullName })
      alert('Profile updated')
      await fetch()
    }catch(e){ console.error(e); alert('Update failed') }
  }

  async function savePhone(e){
    e.preventDefault()
    const p = (phone || '').trim()
    if(p.length < 6){
      alert('Enter a valid phone number')
      return
    }
    try{
      const r = await setMyPhone(p)
      setPhone(r.data.phone_number || p)
      setPhoneVerified(!!r.data.phone_verified)
      alert('Phone saved')
    }catch(e){
      const msg = e?.response?.data?.detail
      alert(msg || 'Failed to save phone')
    }
  }

  async function acceptReq(id){
    try{
      await acceptContactRequest(id)
      alert('Accepted. You can now view contact by mutual consent.')
      await fetch()
    }catch(e){
      const msg = e?.response?.data?.detail
      alert(msg || 'Accept failed')
    }
  }

  async function declineReq(id){
    try{
      await declineContactRequest(id)
      await fetch()
    }catch(e){
      const msg = e?.response?.data?.detail
      alert(msg || 'Decline failed')
    }
  }

  async function viewContact(id){
    try{
      const r = await getContactInfo(id)
      setContactMap(prev => ({ ...prev, [id]: r.data }))
    }catch(e){
      const msg = e?.response?.data?.detail
      alert(msg || 'Contact not available')
    }
  }

  async function doChangePw(e){
    e.preventDefault()
    try{
      await changePassword(curPw, newPw)
      alert('Password changed')
      setCurPw(''); setNewPw('')
    }catch(e){ console.error(e); alert('Password change failed') }
  }

  if(!user) return <div className="max-w-xl mx-auto">Loading...</div>

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Profile</h2>
      <form onSubmit={saveProfile} className="bg-white p-4 rounded shadow space-y-3">
        <label className="block text-sm">Full name
          <input value={fullName} onChange={e=>setFullName(e.target.value)} className="mt-1 block w-full p-2 border rounded" />
        </label>
        <div className="text-sm text-slate-500">Email: {user.email}</div>
        <button className="bg-emerald-700 text-white px-3 py-2 rounded">Save</button>
      </form>

      <form onSubmit={savePhone} className="bg-white p-4 rounded shadow space-y-3">
        <h3 className="font-medium">Phone (private)</h3>
        <div className="text-sm text-slate-600">
          Phone numbers are never public. They’re revealed only after mutual consent in a contact exchange.
        </div>
        <label className="block text-sm">Phone number
          <input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 block w-full p-2 border rounded" placeholder="+1 555 123 4567" />
        </label>
        <div className="text-xs text-slate-500">Status: {phoneVerified ? 'Verified' : 'Not verified'}</div>
        <button className="bg-emerald-700 text-white px-3 py-2 rounded">Save phone</button>
      </form>

      <div className="bg-white p-4 rounded shadow space-y-3">
        <h3 className="font-medium">Incoming contact requests</h3>
        <div className="text-sm text-slate-600">Accept or decline. Phone numbers are shared only after acceptance.</div>
        {incoming.length === 0 ? (
          <div className="text-sm text-slate-500">No pending requests.</div>
        ) : (
          <div className="space-y-3">
            {incoming.map(r => (
              <div key={r.id} className="border rounded-lg p-3 bg-slate-50">
                <div className="text-sm font-medium">
                  {r.requester_name || r.requester_email || `user#${r.requester_user_id}`}
                </div>
                <div className="text-xs text-slate-500">Listing: {r.listing_title || 'External listing'}</div>
                {r.listing_url && (
                  <a className="text-sm text-emerald-700 break-all" href={r.listing_url} target="_blank" rel="noreferrer">Open link</a>
                )}
                <div className="text-xs text-slate-500 mt-1">Status: {r.status}</div>

                <div className="flex gap-2 mt-2">
                  <button onClick={()=>acceptReq(r.id)} className="bg-emerald-700 text-white px-3 py-1 rounded">Accept</button>
                  <button onClick={()=>declineReq(r.id)} className="bg-white border px-3 py-1 rounded">Decline</button>
                  <button onClick={()=>viewContact(r.id)} className="bg-slate-200 px-3 py-1 rounded">View contact</button>
                </div>

                {contactMap[r.id] && (
                  <div className="mt-3 bg-white border rounded-lg p-3">
                    <div className="text-sm font-semibold">Contact exchanged by mutual consent</div>
                    <div className="text-sm mt-1">Requester phone: {contactMap[r.id].requester_phone_number}</div>
                    <div className="text-sm">Your phone: {contactMap[r.id].target_phone_number}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={doChangePw} className="bg-white p-4 rounded shadow space-y-3">
        <h3 className="font-medium">Change password</h3>
        <label className="block text-sm">Current password
          <input type="password" value={curPw} onChange={e=>setCurPw(e.target.value)} className="mt-1 block w-full p-2 border rounded" />
        </label>
        <label className="block text-sm">New password
          <input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)} className="mt-1 block w-full p-2 border rounded" />
        </label>
        <button className="bg-emerald-700 text-white px-3 py-2 rounded">Change Password</button>
      </form>
    </div>
  )
}
