import React, { useEffect, useState } from 'react'
import {
  getAdminUsers,
  getAdminApartments,
  deleteAdminUser,
  deleteAdminApartment,
  getAdminApplications,
  deleteAdminApplication,
  adminCleanDB,
  adminSendEmail,
  adminSendNotification,
  adminCommunityEvents,
  adminApproveCommunityEvent,
  adminRejectCommunityEvent,
  adminCommunityPosts,
  adminPinCommunityPost,
  adminDeleteCommunityPost,
  adminResourcesItems,
  adminApproveResource,
  adminRejectResource,
  adminDeleteResource,
  adminJobsListings,
  adminApproveJob,
  adminRejectJob,
  adminDeleteJob,
} from '../api'

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

  const [notifTarget, setNotifTarget] = useState('all')
  const [notifUserId, setNotifUserId] = useState('')
  const [notifTitle, setNotifTitle] = useState('')
  const [notifMessage, setNotifMessage] = useState('')
  const [notifIncludeAdmins, setNotifIncludeAdmins] = useState(false)
  const [notifStatus, setNotifStatus] = useState('')

  const [communityEvents, setCommunityEvents] = useState([])
  const [communityPosts, setCommunityPosts] = useState([])
  const [resourceItems, setResourceItems] = useState([])
  const [jobListings, setJobListings] = useState([])

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

    try{
      const r = await adminCommunityEvents('pending')
      setCommunityEvents(Array.isArray(r.data) ? r.data : [])
    }catch(e){ console.error(e) }

    try{
      const r = await adminCommunityPosts()
      setCommunityPosts(Array.isArray(r.data) ? r.data : [])
    }catch(e){ console.error(e) }

    try{
      const r = await adminResourcesItems('pending')
      setResourceItems(Array.isArray(r.data) ? r.data : [])
    }catch(e){ console.error(e) }

    try{
      const r = await adminJobsListings('pending')
      setJobListings(Array.isArray(r.data) ? r.data : [])
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

  async function approveEvent(id){
    try{
      await adminApproveCommunityEvent(id)
      fetchAll()
    }catch(e){ console.error(e); alert('Approve failed') }
  }

  async function rejectEvent(id){
    try{
      await adminRejectCommunityEvent(id)
      fetchAll()
    }catch(e){ console.error(e); alert('Reject failed') }
  }

  async function togglePinPost(post){
    try{
      await adminPinCommunityPost(post.id, !post.is_pinned)
      fetchAll()
    }catch(e){ console.error(e); alert('Pin toggle failed') }
  }

  async function deletePost(id){
    if(!confirm('Delete community post? This cannot be undone')) return
    try{
      await adminDeleteCommunityPost(id)
      fetchAll()
    }catch(e){ console.error(e); alert('Delete failed') }
  }

  async function approveResource(id){
    try{
      await adminApproveResource(id)
      fetchAll()
    }catch(e){ console.error(e); alert('Approve failed') }
  }

  async function rejectResource(id){
    try{
      await adminRejectResource(id)
      fetchAll()
    }catch(e){ console.error(e); alert('Reject failed') }
  }

  async function deleteResource(id){
    if(!confirm('Delete resource? This cannot be undone')) return
    try{
      await adminDeleteResource(id)
      fetchAll()
    }catch(e){ console.error(e); alert('Delete failed') }
  }

  async function approveJob(id){
    try{
      await adminApproveJob(id)
      fetchAll()
    }catch(e){ console.error(e); alert('Approve failed') }
  }

  async function rejectJob(id){
    try{
      await adminRejectJob(id)
      fetchAll()
    }catch(e){ console.error(e); alert('Reject failed') }
  }

  async function deleteJob(id){
    if(!confirm('Delete job listing? This cannot be undone')) return
    try{
      await adminDeleteJob(id)
      fetchAll()
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

  async function submitNotification(e){
    e.preventDefault()
    setNotifStatus('')
    if(!notifMessage.trim()){
      alert('Message is required')
      return
    }
    if(notifTarget === 'user' && !notifUserId){
      alert('Select a user')
      return
    }
    try{
      const payload = {
        target: notifTarget,
        user_id: notifTarget === 'user' ? Number(notifUserId) : undefined,
        title: notifTitle && notifTitle.trim() ? notifTitle.trim() : undefined,
        message: notifMessage,
        include_admins: notifIncludeAdmins,
      }
      const resp = await adminSendNotification(payload)
      const data = resp && resp.data ? resp.data : null
      if(data && typeof data.created !== 'undefined'){
        setNotifStatus(`Created: ${data.created}`)
      }else{
        setNotifStatus('Notification request sent')
      }
      alert('Notification sent')
      setNotifTitle('')
      setNotifMessage('')
      setNotifUserId('')
    }catch(e){
      console.error(e)
      alert('Notification send failed')
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
        <h3 className="font-medium">In‑App Notifications</h3>
        <div className="text-xs text-slate-500 mt-1">These show up only in the bell modal in the header.</div>
        <form onSubmit={submitNotification} className="mt-2 space-y-2">
          <div className="flex gap-2">
            <select value={notifTarget} onChange={e=>setNotifTarget(e.target.value)} className="border rounded px-2 py-2 text-sm flex-1">
              <option value="all">All users</option>
              <option value="user">One user</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={notifIncludeAdmins} onChange={e=>setNotifIncludeAdmins(e.target.checked)} />
              Include admins
            </label>
          </div>

          {notifTarget === 'user' && (
            <select value={notifUserId} onChange={e=>setNotifUserId(e.target.value)} className="border rounded px-2 py-2 text-sm w-full">
              <option value="">Select a user…</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{(u.full_name || u.email) + ' — ' + u.email}</option>
              ))}
            </select>
          )}

          <input value={notifTitle} onChange={e=>setNotifTitle(e.target.value)} placeholder="Title (optional)" className="border rounded px-3 py-2 text-sm w-full" />
          <textarea value={notifMessage} onChange={e=>setNotifMessage(e.target.value)} placeholder="Message" className="border rounded px-3 py-2 text-sm w-full h-28" />
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">{notifStatus}</div>
            <button className="text-sm px-3 py-2 bg-emerald-700 text-white rounded">Send Notification</button>
          </div>
        </form>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-medium">Community: Pending Events</h3>
        <div className="text-xs text-slate-500 mt-1">Approve or reject event submissions.</div>
        <div className="mt-2 space-y-2 text-sm text-slate-700">
          {communityEvents.map(ev => (
            <div key={ev.id} className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <div className="font-medium">{ev.title}</div>
                <div className="text-xs text-slate-400">By {ev.created_by_name || `user#${ev.created_by_user_id}`} • {ev.starts_at ? new Date(ev.starts_at).toLocaleString() : ''}</div>
                {ev.location && <div className="text-xs">{ev.location}</div>}
                {ev.description && <div className="text-xs mt-1 whitespace-pre-wrap">{ev.description}</div>}
              </div>
              <div className="flex gap-2">
                <button onClick={()=>approveEvent(ev.id)} className="text-sm px-3 py-1 bg-emerald-700 text-white rounded">Approve</button>
                <button onClick={()=>rejectEvent(ev.id)} className="text-sm px-3 py-1 bg-amber-50 text-amber-700 rounded">Reject</button>
              </div>
            </div>
          ))}
          {!communityEvents.length && <div className="text-slate-500">No pending events.</div>}
        </div>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-medium">Community: Posts (Pin/Delete)</h3>
        <div className="text-xs text-slate-500 mt-1">Pin important posts to keep them at the top.</div>
        <div className="mt-2 space-y-2 text-sm text-slate-700">
          {communityPosts.slice(0, 30).map(p => (
            <div key={p.id} className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <div className="font-medium">{p.is_pinned ? '📌 ' : ''}{p.title || `Post #${p.id}`}</div>
                <div className="text-xs text-slate-400">By {p.created_by_name || `user#${p.created_by_user_id}`} • {p.created_at ? new Date(p.created_at).toLocaleString() : ''} • {p.comments_count || 0} comments</div>
                <div className="text-xs mt-1 whitespace-pre-wrap">{p.body}</div>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={()=>togglePinPost(p)} className="text-sm px-3 py-1 bg-slate-100 rounded">{p.is_pinned ? 'Unpin' : 'Pin'}</button>
                <button onClick={()=>deletePost(p.id)} className="text-sm px-3 py-1 text-red-700 bg-red-50 rounded">Delete</button>
              </div>
            </div>
          ))}
          {!communityPosts.length && <div className="text-slate-500">No posts.</div>}
        </div>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-medium">Resources: Pending Items</h3>
        <div className="text-xs text-slate-500 mt-1">Approve resources so users can see and save them.</div>
        <div className="mt-2 space-y-2 text-sm text-slate-700">
          {resourceItems.map(it => (
            <div key={it.id} className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <div className="font-medium">{it.title}</div>
                <div className="text-xs text-slate-400">By {it.created_by_name || `user#${it.created_by_user_id}`} • {it.category || 'Uncategorized'}</div>
                {it.url && <div className="text-xs break-all">{it.url}</div>}
                {it.description && <div className="text-xs mt-1 whitespace-pre-wrap">{it.description}</div>}
              </div>
              <div className="flex gap-2">
                <button onClick={()=>approveResource(it.id)} className="text-sm px-3 py-1 bg-emerald-700 text-white rounded">Approve</button>
                <button onClick={()=>rejectResource(it.id)} className="text-sm px-3 py-1 bg-amber-50 text-amber-700 rounded">Reject</button>
                <button onClick={()=>deleteResource(it.id)} className="text-sm px-3 py-1 text-red-700 bg-red-50 rounded">Delete</button>
              </div>
            </div>
          ))}
          {!resourceItems.length && <div className="text-slate-500">No pending resources.</div>}
        </div>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-medium">Jobs: Pending Listings</h3>
        <div className="text-xs text-slate-500 mt-1">Approve job listings so users can browse and apply.</div>
        <div className="mt-2 space-y-2 text-sm text-slate-700">
          {jobListings.map(j => (
            <div key={j.id} className="flex justify-between items-start gap-3">
              <div className="flex-1">
                <div className="font-medium">{j.title}</div>
                <div className="text-xs text-slate-400">By {j.created_by_name || `user#${j.created_by_user_id}`} • {j.company || 'Company'}{j.location ? ' • ' + j.location : ''}</div>
                {j.salary && <div className="text-xs">Salary: {j.salary}</div>}
                {j.apply_url && <div className="text-xs break-all">{j.apply_url}</div>}
                {j.description && <div className="text-xs mt-1 whitespace-pre-wrap">{j.description}</div>}
              </div>
              <div className="flex gap-2">
                <button onClick={()=>approveJob(j.id)} className="text-sm px-3 py-1 bg-emerald-700 text-white rounded">Approve</button>
                <button onClick={()=>rejectJob(j.id)} className="text-sm px-3 py-1 bg-amber-50 text-amber-700 rounded">Reject</button>
                <button onClick={()=>deleteJob(j.id)} className="text-sm px-3 py-1 text-red-700 bg-red-50 rounded">Delete</button>
              </div>
            </div>
          ))}
          {!jobListings.length && <div className="text-slate-500">No pending job listings.</div>}
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
