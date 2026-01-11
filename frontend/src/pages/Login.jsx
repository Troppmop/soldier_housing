import React, {useState} from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()
  const { login } = useAuth()

  async function submit(e){
    e.preventDefault()
    try{
      await login(email, password)
      navigate('/')
    }catch(err){
      alert('Login failed')
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-lg mt-8">
      <h2 className="text-2xl font-semibold mb-2 text-center">Welcome, Lone Soldier</h2>
      <p className="text-sm text-slate-500 mb-4 text-center">Find apartments, post rooms, and apply to join households — quick and secure.</p>
      <form onSubmit={submit} className="space-y-4" aria-label="Login form">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" type="email" required className="w-full p-3 border rounded-lg" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" required className="w-full p-3 border rounded-lg" />
        </div>

        <div className="flex flex-col gap-3">
          <button className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-3 rounded-lg font-medium">Sign in</button>
          <a href="/register" className="text-center text-sm text-emerald-700">Create an account</a>
        </div>
      </form>
    </div>
  )
}
