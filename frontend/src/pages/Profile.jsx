import React, { useEffect, useState } from 'react'
import { getCurrentUser, updateProfile, changePassword } from '../api'

export default function Profile(){
  const [user, setUser] = useState(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')

  useEffect(()=>{ fetch() },[])
  async function fetch(){
    try{
      const u = await getCurrentUser()
      setUser(u)
      setFullName(u.full_name || '')
      setPhone(u.phone || '')
    }catch(e){ console.error(e) }
  }

  async function saveProfile(e){
    e.preventDefault()
    try{
      await updateProfile({ full_name: fullName, phone })
      alert('Profile updated')
      fetch()
    }catch(e){ console.error(e); alert('Update failed') }
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
        <label className="block text-sm">Phone
          <input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 block w-full p-2 border rounded" />
        </label>
        <div className="text-sm text-slate-500">Email: {user.email}</div>
        <button className="bg-emerald-700 text-white px-3 py-2 rounded">Save</button>
      </form>

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
