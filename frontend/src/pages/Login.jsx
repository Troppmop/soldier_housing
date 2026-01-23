import React, {useEffect, useState} from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { initApi, requestPasswordReset, verifyResetCode, resetPassword, getPublicStats } from '../api'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [resetStep, setResetStep] = useState(1)
  const [resetCode, setResetCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [busy, setBusy] = useState(false)
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const navigate = useNavigate()
  const { login } = useAuth()

  useEffect(()=>{
    let mounted = true
    ;(async ()=>{
      try{
        await initApi()
        const resp = await getPublicStats()
        if(mounted) setStats(resp.data)
      }catch(e){
        // optional; ignore if backend doesn't support yet / network issues
        if(mounted) setStats(null)
      }finally{
        if(mounted) setStatsLoading(false)
      }
    })()
    return ()=>{ mounted = false }
  },[])

  async function submit(e){
    e.preventDefault()
    try{
      await login(email, password)
      navigate('/')
    }catch(err){
      alert('Login failed')
    }
  }

  async function sendResetCode(e){
    e.preventDefault()
    setBusy(true)
    try{
      await initApi()
      await requestPasswordReset(email)
      setResetStep(2)
      alert('If that email exists, a 6-digit code was sent.')
    }catch(err){
      // keep response generic to avoid account enumeration
      console.warn('requestPasswordReset failed', err)
      alert('If that email exists, a 6-digit code was sent.')
      setResetStep(2)
    }finally{
      setBusy(false)
    }
  }

  async function verifyCode(e){
    e.preventDefault()
    const code = (resetCode || '').trim()
    if(code.length !== 6){
      alert('Enter the 6-digit code')
      return
    }
    setBusy(true)
    try{
      await initApi()
      const resp = await verifyResetCode(email, code)
      setResetToken(resp.data.reset_token)
      setResetStep(3)
    }catch(err){
      alert('Invalid or expired code')
    }finally{
      setBusy(false)
    }
  }

  async function confirmReset(e){
    e.preventDefault()
    if(!newPassword || newPassword.length < 6){
      alert('Password must be at least 6 characters')
      return
    }
    if(newPassword !== newPassword2){
      alert('Passwords do not match')
      return
    }
    setBusy(true)
    try{
      await initApi()
      await resetPassword(resetToken, newPassword)
      alert('Password updated. Please sign in again.')
      setMode('login')
      setResetStep(1)
      setResetCode('')
      setResetToken('')
      setNewPassword('')
      setNewPassword2('')
      setPassword('')
    }catch(err){
      alert('Reset failed. Please request a new code.')
      setResetStep(1)
      setResetCode('')
      setResetToken('')
    }finally{
      setBusy(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-lg mt-8">
      {mode === 'login' ? (
        <>
          <h2 className="text-2xl font-semibold mb-2 text-center">Welcome, Lone Soldier</h2>
          <p className="text-sm text-slate-500 mb-4 text-center">Find apartments, post rooms, and apply to join households — quick and secure.</p>

          <div className="mb-4 rounded-lg border bg-slate-50 px-4 py-3 text-center">
            <div className="text-xs text-slate-500">Community stats</div>
            {statsLoading ? (
              <div className="text-sm text-slate-700 mt-1">Loading…</div>
            ) : (
              <div className="text-sm text-slate-700 mt-1">
                <span className="font-semibold">{stats && typeof stats.users_count === 'number' ? stats.users_count : '—'}</span> users ·{' '}
                <span className="font-semibold">{stats && typeof stats.posts_count === 'number' ? stats.posts_count : '—'}</span> posts
              </div>
            )}
          </div>

          <form onSubmit={submit} className="space-y-4" aria-label="Login form">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" type="email" required className="w-full p-3 border rounded-lg" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <button type="button" onClick={()=>{ setMode('forgot'); setResetStep(1) }} className="text-xs text-emerald-700 hover:underline">Forgot password?</button>
              </div>
              <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" required className="w-full p-3 border rounded-lg" />
            </div>

            <div className="flex flex-col gap-3">
              <button className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-3 rounded-lg font-medium">Sign in</button>
              <a href="/register" className="text-center text-sm text-emerald-700">Create an account</a>
            </div>
          </form>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-semibold mb-2 text-center">Reset password</h2>
          <p className="text-sm text-slate-500 mb-4 text-center">We’ll email you a 6-digit code. It expires after 10 minutes.</p>

          {resetStep === 1 && (
            <form onSubmit={sendResetCode} className="space-y-4" aria-label="Forgot password request">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" type="email" required className="w-full p-3 border rounded-lg" />
              </div>
              <button disabled={busy} className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-3 rounded-lg font-medium">Send code</button>
              <button type="button" onClick={()=>setMode('login')} className="w-full text-sm text-slate-600 hover:underline">Back to sign in</button>
            </form>
          )}

          {resetStep === 2 && (
            <form onSubmit={verifyCode} className="space-y-4" aria-label="Verify reset code">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">6-digit code</label>
                <input value={resetCode} onChange={e=>setResetCode(e.target.value)} inputMode="numeric" pattern="[0-9]{6}" placeholder="123456" required className="w-full p-3 border rounded-lg tracking-widest text-center" />
                <p className="text-xs text-slate-500 mt-1">Code expires in 10 minutes.</p>
              </div>
              <button disabled={busy} className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-3 rounded-lg font-medium">Verify code</button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={()=>setResetStep(1)} className="text-slate-600 hover:underline">Change email</button>
                <button type="button" onClick={sendResetCode} className="text-emerald-700 hover:underline" disabled={busy}>Resend</button>
              </div>
            </form>
          )}

          {resetStep === 3 && (
            <form onSubmit={confirmReset} className="space-y-4" aria-label="Set new password">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
                <input value={newPassword} onChange={e=>setNewPassword(e.target.value)} type="password" required className="w-full p-3 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
                <input value={newPassword2} onChange={e=>setNewPassword2(e.target.value)} type="password" required className="w-full p-3 border rounded-lg" />
              </div>
              <button disabled={busy} className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white px-4 py-3 rounded-lg font-medium">Update password</button>
              <button type="button" onClick={()=>{ setMode('login'); setResetStep(1) }} className="w-full text-sm text-slate-600 hover:underline">Back to sign in</button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
