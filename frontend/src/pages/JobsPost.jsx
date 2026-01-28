import React, { useState } from 'react'
import { initApi, jobsCreate } from '../api'

export default function JobsPost(){
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [salary, setSalary] = useState('')
  const [applyUrl, setApplyUrl] = useState('')
  const [description, setDescription] = useState('')

  async function submit(e){
    e.preventDefault()
    const t = (title || '').trim()
    if(!t) return alert('Title is required')
    try{
      await initApi()
      await jobsCreate({
        title: t,
        company: (company || '').trim() || null,
        location: (location || '').trim() || null,
        salary: (salary || '').trim() || null,
        apply_url: (applyUrl || '').trim() || null,
        description: (description || '').trim() || null,
      })
      setTitle('')
      setCompany('')
      setLocation('')
      setSalary('')
      setApplyUrl('')
      setDescription('')
      alert('Job submitted (pending admin approval).')
    }catch(e){
      console.error(e)
      alert('Failed to submit job')
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Post a Job</h2>
      <section className="bg-white p-4 rounded shadow">
        <div className="text-xs text-slate-500">Jobs require admin approval before everyone sees them.</div>
        <form onSubmit={submit} className="mt-2 space-y-2">
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Job title" className="border rounded px-3 py-2 text-sm w-full" />
          <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="Company (optional)" className="border rounded px-3 py-2 text-sm w-full" />
          <input value={location} onChange={e=>setLocation(e.target.value)} placeholder="Location (optional)" className="border rounded px-3 py-2 text-sm w-full" />
          <input value={salary} onChange={e=>setSalary(e.target.value)} placeholder="Salary (optional)" className="border rounded px-3 py-2 text-sm w-full" />
          <input value={applyUrl} onChange={e=>setApplyUrl(e.target.value)} placeholder="Apply URL (optional)" className="border rounded px-3 py-2 text-sm w-full" />
          <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description (optional)" className="border rounded px-3 py-2 text-sm w-full h-28" />
          <div className="flex justify-end">
            <button className="text-sm px-3 py-2 bg-emerald-700 text-white rounded">Submit</button>
          </div>
        </form>
      </section>
      <div className="h-20" />
    </div>
  )
}
