import React from 'react'

export default function Modal({ open, title, onClose, children }){
  if(!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div className="relative w-full md:w-1/2 bg-white rounded-t-xl md:rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-500">✕</button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}
