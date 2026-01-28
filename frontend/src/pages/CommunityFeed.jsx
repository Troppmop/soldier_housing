import React, { useEffect, useState } from 'react'
import { initApi, communityAddComment, communityCreatePost, communityListComments, communityListPosts } from '../api'

export default function CommunityFeed(){
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')

  const [search, setSearch] = useState('')

  const [commentsByPost, setCommentsByPost] = useState({})
  const [commentsOpen, setCommentsOpen] = useState({})
  const [commentDraft, setCommentDraft] = useState({})

  async function refresh(nextSearch){
    setLoading(true)
    try{
      await initApi()
      const s = typeof nextSearch === 'string' ? nextSearch : search
      const resp = await communityListPosts(0, 50, (s || '').trim() || undefined)
      setPosts(Array.isArray(resp.data) ? resp.data : [])
    }catch(e){
      console.error(e)
      alert('Failed to load community feed')
    }finally{
      setLoading(false)
    }
  }

  useEffect(()=>{ refresh() },[])

  async function submitPost(e){
    e.preventDefault()
    const body = (newBody || '').trim()
    const title = (newTitle || '').trim()
    if(!body) return alert('Post body is required')
    try{
      await initApi()
      await communityCreatePost({ title: title || null, body })
      setNewTitle('')
      setNewBody('')
      await refresh()
    }catch(e){
      console.error(e)
      alert('Failed to create post')
    }
  }

  async function toggleComments(postId){
    const open = !!commentsOpen[postId]
    setCommentsOpen(prev => ({...prev, [postId]: !open}))
    if(!open && !commentsByPost[postId]){
      try{
        await initApi()
        const resp = await communityListComments(postId)
        setCommentsByPost(prev => ({...prev, [postId]: Array.isArray(resp.data) ? resp.data : []}))
      }catch(e){
        console.error(e)
        alert('Failed to load comments')
      }
    }
  }

  async function submitComment(postId){
    const body = (commentDraft[postId] || '').trim()
    if(!body) return
    try{
      await initApi()
      await communityAddComment(postId, { body })
      setCommentDraft(prev => ({...prev, [postId]: ''}))
      const resp = await communityListComments(postId)
      setCommentsByPost(prev => ({...prev, [postId]: Array.isArray(resp.data) ? resp.data : []}))
      await refresh()
    }catch(e){
      console.error(e)
      alert('Failed to add comment')
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold">Community Feed</h2>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-medium">Search</h3>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e)=>{ e.preventDefault(); refresh() }}
        >
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="Search posts (title/body)…"
            className="border rounded px-3 py-2 text-sm flex-1"
          />
          <button type="submit" className="text-sm px-3 py-2 bg-slate-100 rounded">Search</button>
        </form>
        {(search || '').trim() && (
          <div className="mt-2">
            <button
              type="button"
              onClick={()=>{ setSearch(''); refresh('') }}
              className="text-xs px-2 py-1 bg-slate-100 rounded"
            >
              Clear
            </button>
          </div>
        )}
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h3 className="font-medium">Create post</h3>
        <form onSubmit={submitPost} className="mt-2 space-y-2">
          <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Title (optional)" className="border rounded px-3 py-2 text-sm w-full" />
          <textarea value={newBody} onChange={e=>setNewBody(e.target.value)} placeholder="Share something…" className="border rounded px-3 py-2 text-sm w-full h-28" />
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">Posts are visible to everyone.</div>
            <button className="text-sm px-3 py-2 bg-emerald-700 text-white rounded">Post</button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Latest</h3>
          <button onClick={()=>refresh()} className="text-sm px-3 py-1 bg-slate-100 rounded">Refresh</button>
        </div>

        {loading && <div className="text-sm text-slate-600">Loading…</div>}
        {!loading && posts.length === 0 && <div className="text-sm text-slate-600">No posts yet.</div>}

        {posts.map(p => (
          <div key={p.id} className="bg-white p-4 rounded shadow">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-900">
                {p.is_pinned && <span className="mr-2 text-emerald-700">📌</span>}
                {p.title || 'Post'}
              </div>
              <div className="text-xs text-slate-400">{p.created_at ? new Date(p.created_at).toLocaleString() : ''}</div>
            </div>
            <div className="text-xs text-slate-500 mt-1">By {p.created_by_name || `user#${p.created_by_user_id}`}</div>
            <div className="text-sm text-slate-800 mt-2 whitespace-pre-wrap">{p.body}</div>

            <div className="mt-3 flex items-center justify-between">
              <button onClick={()=>toggleComments(p.id)} className="text-sm text-emerald-700">
                {commentsOpen[p.id] ? 'Hide' : 'Show'} comments ({p.comments_count || 0})
              </button>
            </div>

            {commentsOpen[p.id] && (
              <div className="mt-3 border-t pt-3 space-y-2">
                <div className="space-y-2">
                  {(commentsByPost[p.id] || []).map(c => (
                    <div key={c.id} className="text-sm bg-slate-50 rounded p-2">
                      <div className="text-xs text-slate-500">{c.created_by_name || `user#${c.created_by_user_id}`} • {c.created_at ? new Date(c.created_at).toLocaleString() : ''}</div>
                      <div className="text-slate-800 whitespace-pre-wrap">{c.body}</div>
                    </div>
                  ))}
                  {(commentsByPost[p.id] || []).length === 0 && <div className="text-sm text-slate-600">No comments yet.</div>}
                </div>

                <div className="flex gap-2">
                  <input
                    value={commentDraft[p.id] || ''}
                    onChange={e=>setCommentDraft(prev => ({...prev, [p.id]: e.target.value}))}
                    placeholder="Write a comment…"
                    className="border rounded px-3 py-2 text-sm flex-1"
                  />
                  <button type="button" onClick={()=>submitComment(p.id)} className="text-sm px-3 py-2 bg-emerald-700 text-white rounded">Send</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="h-20" />
    </div>
  )
}
