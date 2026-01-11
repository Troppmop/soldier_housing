import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import './index.css'
import Login from './pages/Login'
import Register from './pages/Register'
import Apartments from './pages/Apartments'
import CreateApartment from './pages/CreateApartment'

function App(){
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <header className="p-4 bg-white shadow-md sticky top-0 z-10">
          <div className="container mx-auto flex items-center justify-between">
            <h1 className="text-xl font-semibold">Soldier Housing</h1>
            <nav className="space-x-3">
              <Link to="/" className="text-sky-600">Home</Link>
              <Link to="/create" className="text-sky-600">Post</Link>
            </nav>
          </div>
        </header>
        <main className="p-4 container mx-auto">
          <Routes>
            <Route path="/" element={<Apartments/>} />
            <Route path="/login" element={<Login/>} />
            <Route path="/register" element={<Register/>} />
            <Route path="/create" element={<CreateApartment/>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')).render(<App />)
