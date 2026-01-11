import React, {useState} from 'react'
import { login } from '../api'
import { useNavigate } from 'react-router-dom'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

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
    <div className="max-w-md mx-auto bg-white p-4 rounded shadow">
      <h2 className="text-lg font-semibold mb-2">Login</h2>
      <form onSubmit={submit} className="space-y-3">
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full p-2 border rounded" />
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" className="w-full p-2 border rounded" />
        <div className="flex justify-between items-center">
          <button className="bg-sky-600 text-white px-4 py-2 rounded">Login</button>
          <a href="/register" className="text-sm text-sky-600">Register</a>
        </div>
      </form>
    </div>
  )
}
