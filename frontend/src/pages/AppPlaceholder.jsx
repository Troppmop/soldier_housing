import React from 'react'

export default function AppPlaceholder({ title = 'Unavailable', subtitle = '' }) {
  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold">{title}</h1>
      {subtitle ? <p className="text-sm opacity-80 mt-1">{subtitle}</p> : null}
    </div>
  )
}
