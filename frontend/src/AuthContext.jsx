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
      const token = localStorage.getItem('token')
      if(!token){
        if(mounted) setLoading(false)
        return
      }
      try{
        const u = await api.getCurrentUser()
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
    await api.login(email, password)
    const u = await api.getCurrentUser()
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
