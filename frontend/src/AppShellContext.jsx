import React, { createContext, useContext, useMemo, useState } from 'react'

const AppShellContext = createContext(null)

export function AppShellProvider({ children }) {
  // Minimal app-shell state holder to unblock builds.
  // Add fields here as needed by future UI work.
  const [state, setState] = useState({})

  const value = useMemo(() => ({ state, setState }), [state])

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
}

export function useAppShell() {
  return useContext(AppShellContext)
}
