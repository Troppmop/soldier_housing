import React, { createContext, useContext, useEffect, useState } from 'react'
import * as api from './api'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }){
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    let mounted = true
    async function check(){
      // ensure API baseURL is initialized (from runtime config or build-time env)
      try{ await api.initApi() }catch(e){ console.warn('initApi failed', e) }
      const token = localStorage.getItem('token')
      if(!token){
        if(mounted) setLoading(false)
        return
      }
      try{
        const u = await api.getCurrentUser()
        // normalize is_admin which may be boolean, number or string from backend
        if(u && typeof u.is_admin !== 'boolean'){
          u.is_admin = !!(u.is_admin === true || u.is_admin === '1' || u.is_admin === 1 || u.is_admin === 'true')
        }
        if(mounted) setUser(u)
      }catch(e){
        localStorage.removeItem('token')
        if(mounted) setUser(null)
      }finally{
        if(mounted) setLoading(false)
      }
    }
    check()
    return ()=>{ mounted = false }
  },[])

  const login = async (email, password) => {
    try{ await api.initApi() }catch(e){ console.warn('initApi failed', e) }
    await api.login(email, password)
    const u = await api.getCurrentUser()
    // normalize is_admin to boolean for reliable checks in UI
    if(u && typeof u.is_admin !== 'boolean'){
      u.is_admin = !!(u.is_admin === true || u.is_admin === '1' || u.is_admin === 1 || u.is_admin === 'true')
    }
    console.log('Auth login user:', u)
    setUser(u)
    return u
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  const register = async (email, password) => api.register(email, password)

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
