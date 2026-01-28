import React, { useEffect } from 'react'
import { initApi } from './api'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import './index.css'
import Header from './components/Header'
import Login from './pages/Login'
import Register from './pages/Register'
import Apartments from './pages/Apartments'
import CreateApartment from './pages/CreateApartment'
import ExternalListings from './pages/ExternalListings'
import CreateExternalListing from './pages/CreateExternalListing'
import Applications from './pages/Applications'
import Admin from './pages/Admin'
import Profile from './pages/Profile'
import { AuthProvider, useAuth } from './AuthContext'
import BottomNav from './components/BottomNav'
import ErrorBoundary from './components/ErrorBoundary'
import { AppShellProvider } from './AppShellContext'
import AppShellSync from './components/AppShellSync'

import { FEATURES } from './featureFlags'
import AppPlaceholder from './pages/AppPlaceholder'
import CommunityFeed from './pages/CommunityFeed'
import CommunityEvents from './pages/CommunityEvents'
import CommunityMessages from './pages/CommunityMessages'

import ResourcesDirectory from './pages/ResourcesDirectory'
import ResourcesGuides from './pages/ResourcesGuides'
import ResourcesSaved from './pages/ResourcesSaved'

import JobsBrowse from './pages/JobsBrowse'
import JobsPost from './pages/JobsPost'
import JobsSaved from './pages/JobsSaved'

const ENABLE_COMMUNITY = !!(FEATURES && FEATURES.community)

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
          <Route path="/external" element={<ExternalListings/>} />
          <Route path="/external/new" element={<CreateExternalListing/>} />
          <Route path="/applications" element={<Applications/>} />
          <Route path="/admin" element={<Admin/>} />
          <Route path="/profile" element={<Profile/>} />

          {/* Side apps */}
          {ENABLE_COMMUNITY ? (
            <>
              <Route path="/community" element={<CommunityFeed/>} />
              <Route path="/community/events" element={<CommunityEvents/>} />
              <Route path="/community/messages" element={<CommunityMessages/>} />
            </>
          ) : (
            <>
              <Route path="/community" element={<AppPlaceholder title="Community" subtitle="Temporarily unavailable." />} />
              <Route path="/community/events" element={<AppPlaceholder title="Community" subtitle="Temporarily unavailable." />} />
              <Route path="/community/messages" element={<AppPlaceholder title="Community" subtitle="Temporarily unavailable." />} />
            </>
          )}

          <Route path="/resources" element={<ResourcesDirectory/>} />
          <Route path="/resources/guides" element={<ResourcesGuides/>} />
          <Route path="/resources/saved" element={<ResourcesSaved/>} />

          <Route path="/jobs" element={<JobsBrowse/>} />
          <Route path="/jobs/post" element={<JobsPost/>} />
          <Route path="/jobs/saved" element={<JobsSaved/>} />
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
      <AppShellProvider>
        <BrowserRouter>
          <AppShellSync />
          <AppRoutes />
          <BottomNav />
        </BrowserRouter>
      </AppShellProvider>
    </AuthProvider>
  )
}

;(async function(){
  try{ await initApi() }catch(e){ console.warn('initApi failed at startup', e) }
  createRoot(document.getElementById('root')).render(<Root />)
})()
