import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import './index.css'
import Header from './components/Header'
import Login from './pages/Login'
import Register from './pages/Register'
import Apartments from './pages/Apartments'
import CreateApartment from './pages/CreateApartment'
import Applications from './pages/Applications'
import Notifications from './pages/Notifications'
import Admin from './pages/Admin'
import Profile from './pages/Profile'
import { AuthProvider, useAuth } from './AuthContext'
import BottomNav from './components/BottomNav'
import ErrorBoundary from './components/ErrorBoundary'

// Top header removed — navigation now on bottom for mobile-first UX

function AppRoutes(){
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(()=>{
    if(!loading && !user){
      // stay on login/register pages, otherwise redirect to login
      if(!window.location.pathname.startsWith('/register') && window.location.pathname !== '/login'){
        navigate('/login')
      }
    }
  },[user,loading,navigate])

  return (
    <div className="min-h-screen bg-hero-bg safe-area-inset">
      <Header />
      <main className="p-4 pt-2 max-w-xl mx-auto">
        <ErrorBoundary>
          <Routes>
          <Route path="/" element={<Apartments/>} />
          <Route path="/login" element={<Login/>} />
          <Route path="/register" element={<Register/>} />
          <Route path="/create" element={<CreateApartment/>} />
          <Route path="/applications" element={<Applications/>} />
          <Route path="/notifications" element={<Notifications/>} />
          <Route path="/admin" element={<Admin/>} />
          <Route path="/profile" element={<Profile/>} />
          </Routes>
        </ErrorBoundary>
      </main>
      <div className="md:hidden">
        {/* bottom nav for mobile */}
        <div className="block"> 
          <link rel="stylesheet" />
        </div>
      </div>
    </div>
  )
}

function Root(){
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <BottomNav />
      </BrowserRouter>
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')).render(<Root />)
