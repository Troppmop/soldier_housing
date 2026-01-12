import React from 'react'

export default class ErrorBoundary extends React.Component{
  constructor(props){
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error){
    return { error }
  }

  componentDidCatch(error, info){
    console.error('Unhandled UI error:', error, info)
  }

  render(){
    if(this.state.error){
      return (
        <div className="p-6 max-w-xl mx-auto mt-8">
          <div className="bg-red-50 border border-red-200 p-4 rounded">
            <h3 className="font-semibold text-red-700">Something went wrong</h3>
            <div className="text-sm text-slate-700 mt-2">{this.state.error.message}</div>
            <div className="text-xs text-slate-500 mt-2">Check browser console/network for details.</div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
