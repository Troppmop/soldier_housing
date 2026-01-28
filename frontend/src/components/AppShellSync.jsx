import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Lightweight placeholder: keeps a hook point for route-driven shell updates.
export default function AppShellSync() {
  const location = useLocation()

  useEffect(() => {
    // no-op for now
  }, [location.pathname])

  return null
}
