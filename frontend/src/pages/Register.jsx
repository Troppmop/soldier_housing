import React, {useState} from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Register(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const navigate = useNavigate()
  const { register } = useAuth()

  async function submit(e){
    e.preventDefault()
    try{
      await register(email, { password, full_name: fullName, phone })
      alert('Registered - please login')
      navigate('/login')
    }catch(err){
      alert('Register failed')
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-lg mt-8">
      <h2 className="text-2xl font-semibold mb-2 text-center">Join the community</h2>
      <p className="text-sm text-slate-500 mb-4 text-center">Register to post available rooms or apply to join an apartment. Keep your service details private — communicate safely inside the app.</p>
      <form onSubmit={submit} className="space-y-4" aria-label="Register form">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
          <input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your full name" className="w-full p-3 border rounded-lg" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone (WhatsApp)</label>
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="05X-XXXXXXX" className="w-full p-3 border rounded-lg" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" type="email" required className="w-full p-3 border rounded-lg" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Choose a secure password" type="password" required className="w-full p-3 border rounded-lg" />
        </div>

        <div className="flex justify-end">
          <button className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg">Create account</button>
        </div>
      </form>
    </div>
  )
}
