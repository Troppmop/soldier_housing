import React, { useEffect, useState } from 'react'
import { getAdminUsers, getAdminApartments, deleteAdminUser, deleteAdminApartment, getAdminApplications, deleteAdminApplication, adminCleanDB } from '../api'

export default function Admin(){
  const [users, setUsers] = useState([])
  const [aps, setAps] = useState([])
  const [apps, setApps] = useState([])

  useEffect(()=>{ fetchAll() },[])
  async function fetchAll(){
    try{
      const u = await getAdminUsers()
      setUsers(u.data)
    }catch(e){ console.error(e) }
    try{
      const a = await getAdminApartments()
      setAps(a.data)
    }catch(e){ console.error(e) }
    try{
      const r = await getAdminApplications()
      setApps(r.data)
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
