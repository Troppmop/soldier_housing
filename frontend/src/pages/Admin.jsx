import React, { useEffect, useState } from 'react'
import { getAdminUsers, getAdminApartments, deleteAdminUser, deleteAdminApartment, getAdminApplications, deleteAdminApplication, adminCleanDB, adminSendEmail } from '../api'

export default function Admin(){
  const [users, setUsers] = useState([])
  const [aps, setAps] = useState([])
  const [apps, setApps] = useState([])

  const [emailTarget, setEmailTarget] = useState('all')
  const [emailUserId, setEmailUserId] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [includeAdmins, setIncludeAdmins] = useState(false)
  const [emailStatus, setEmailStatus] = useState('')

  useEffect(()=>{ fetchAll() },[])
  async function fetchAll(){
    try{
      const u = await getAdminUsers()
      const ud = u && u.data ? u.data : []
      if(!Array.isArray(ud)){
        console.error('/admin/users returned unexpected shape', ud)
      }
      setUsers(Array.isArray(ud) ? ud : [])
    }catch(e){ console.error(e) }
    try{
      const a = await getAdminApartments()
      const ad = a && a.data ? a.data : []
      if(!Array.isArray(ad)){
        console.error('/admin/apartments returned unexpected shape', ad)
      }
      setAps(Array.isArray(ad) ? ad : [])
    }catch(e){ console.error(e) }
    try{
      const r = await getAdminApplications()
      const rd = r && r.data ? r.data : []
      if(!Array.isArray(rd)){
        console.error('/admin/applications returned unexpected shape', rd)
      }
      setApps(Array.isArray(rd) ? rd : [])
    }catch(e){ console.error(e) }
  }

  useEffect(()=>{
    const handler = ()=> fetchAll()
    window.addEventListener('admin-refresh', handler)
    return ()=> window.removeEventListener('admin-refresh', handler)
  },[])

  async function deleteUser(id){
    if(!confirm('Delete user? This cannot be undone')) return
    try{
      await deleteAdminUser(id)
      alert('Deleted')
      fetchAll()
    }catch(e){ console.error(e); alert('Delete failed') }
  }

  async function deleteApartment(id){
    if(!confirm('Delete apartment? This cannot be undone')) return
    try{
      await deleteAdminApartment(id)
      alert('Deleted')
      fetchAll()
    }catch(e){ console.error(e); alert('Delete failed') }
  }

  async function fetchApps(){
    try{
      const r = await getAdminApplications()
      setApps(r.data)
    }catch(e){ console.error(e) }
  }

  async function deleteApp(id){
    if(!confirm('Delete application? This cannot be undone')) return
    try{
      await deleteAdminApplication(id)
      alert('Deleted')
      fetchAll(); fetchApps()
    }catch(e){ console.error(e); alert('Delete failed') }
  }

  async function doClean(){
    if(!confirm('Clean database: remove all non-admin users, apartments, applications, and notifications?')) return
    try{
      await adminCleanDB()
      alert('Database cleaned')
      fetchAll(); fetchApps()
    }catch(e){ console.error(e); alert('Clean failed') }
  }

  async function submitEmail(e){
    e.preventDefault()
    setEmailStatus('')
    if(!emailSubject.trim()){
      alert('Subject is required')
      return
    }
    if(!emailMessage.trim()){
      alert('Message is required')
      return
    }
    if(emailTarget === 'user' && !emailUserId){
      alert('Select a user')
      return
    }
    try{
      const payload = {
        target: emailTarget,
        user_id: emailTarget === 'user' ? Number(emailUserId) : undefined,
        subject: emailSubject,
        message: emailMessage,
        include_admins: includeAdmins,
      }
      const resp = await adminSendEmail(payload)
      const data = resp && resp.data ? resp.data : null
      if(data && typeof data.sent !== 'undefined'){
        setEmailStatus(`Sent: ${data.sent}, Failed: ${data.failed}`)
      }else{
        setEmailStatus('Email request sent')
      }
      alert('Email sent')
    }catch(e){
      console.error(e)
      alert('Email send failed')
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Admin Panel</h2>
      <div className="flex justify-end">
        <button onClick={doClean} className="text-sm px-3 py-1 bg-red-50 text-red-700 rounded">Clean DB</button>
      </div>
      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-medium">Users</h3>
        <div className="mt-2 space-y-2 text-sm text-slate-700">
          {users.map(u=> (
            <div key={u.id} className="flex justify-between items-center">
              <div>
                <div className="font-medium">{u.full_name || u.email}</div>
                <div className="text-xs text-slate-400">{u.email} {u.is_admin && <span className="ml-2 text-emerald-700">(admin)</span>}</div>
                {u.phone && <div className="text-xs">Phone: {u.phone}</div>}
              </div>
              <div>
                <button onClick={()=>deleteUser(u.id)} className="text-red-600 text-sm">Delete</button>
              </div>
            </div>
          ))}
          {!users.length && <div className="text-slate-500">No users.</div>}
        </div>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-medium">Email Users</h3>
        <form onSubmit={submitEmail} className="mt-2 space-y-2">
          <div className="flex gap-2">
            <select value={emailTarget} onChange={e=>setEmailTarget(e.target.value)} className="border rounded px-2 py-2 text-sm flex-1">
              <option value="all">All users</option>
              <option value="user">One user</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={includeAdmins} onChange={e=>setIncludeAdmins(e.target.checked)} />
              Include admins
            </label>
          </div>

          {emailTarget === 'user' && (
            <select value={emailUserId} onChange={e=>setEmailUserId(e.target.value)} className="border rounded px-2 py-2 text-sm w-full">
              <option value="">Select a user…</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{(u.full_name || u.email) + ' — ' + u.email}</option>
              ))}
            </select>
          )}

          <input value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} placeholder="Subject" className="border rounded px-3 py-2 text-sm w-full" />
          <textarea value={emailMessage} onChange={e=>setEmailMessage(e.target.value)} placeholder="Message" className="border rounded px-3 py-2 text-sm w-full h-28" />
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">{emailStatus}</div>
            <button className="text-sm px-3 py-2 bg-emerald-700 text-white rounded">Send Email</button>
          </div>
        </form>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-medium">Applications</h3>
        <div className="mt-2 space-y-2 text-sm text-slate-700">
          {apps && apps.map(a=> (
            <div key={a.id} className="flex justify-between items-center">
              <div>
                <div className="font-medium">{a.apartment_title || `apt#${a.apartment_id}`}</div>
                <div className="text-xs text-slate-400">From: {a.applicant_name || `#${a.applicant_id}`}</div>
                <div className="text-xs mt-1">{a.message}</div>
                <div className="text-xs text-slate-400">Status: {a.status}</div>
              </div>
              <div>
                <button onClick={()=>deleteApp(a.id)} className="text-red-600 text-sm">Delete</button>
              </div>
            </div>
          ))}
          {(!apps || !apps.length) && <div className="text-slate-500">No applications.</div>}
        </div>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-medium">Apartments</h3>
        <div className="mt-2 space-y-2 text-sm text-slate-700">
          {aps.map(a=> (
            <div key={a.id} className="flex justify-between items-center">
              <div>
                <div className="font-medium">{a.title}</div>
                <div className="text-xs text-slate-400">Owner: {a.owner_email || `#${a.owner_id}`}</div>
              </div>
              <div>
                <button onClick={()=>deleteApartment(a.id)} className="text-red-600 text-sm">Delete</button>
              </div>
            </div>
          ))}
          {!aps.length && <div className="text-slate-500">No apartments.</div>}
        </div>
      </section>
    </div>
  )
}
