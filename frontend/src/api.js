import axios from 'axios'

// Runtime-config fallback: attempt to load `/config.json` from the same origin
// (this allows changing the backend URL without rebuilding the app). If that
// file is missing, fall back to the build-time `import.meta.env.VITE_API_URL`.
async function resolveBase(){
  try{
    const resp = await fetch('/config.json', { cache: 'no-cache' })
    if (resp.ok){
      const cfg = await resp.json()
      if (cfg && cfg.VITE_API_URL){
        let b = cfg.VITE_API_URL
        if (b && !b.startsWith('http://') && !b.startsWith('https://')) b = 'https://' + b
        console.log('API base URL (runtime):', b)
        return b
      }
    }
  }catch(e){
    // ignore and fallback to build-time env
  }

  let base = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  if (base && !base.startsWith('http://') && !base.startsWith('https://')){
    base = 'https://' + base
  }
  console.log('API base URL (build):', base)
  return base
}

// Create a placeholder axios instance; we'll update its baseURL after resolving
// config. Callers may import `API` and `await initApi()` if they need the base
// to be resolved before first request.
const API = axios.create()
let _apiInitPromise = null
export function initApi(){
  if (!_apiInitPromise) _apiInitPromise = (async ()=>{
    const base = await resolveBase()
    API.defaults.baseURL = base
    return base
  })()
  return _apiInitPromise
}

export async function login(email, password){
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  try{
    // Use configured axios instance; ensure initApi() was called by the caller
    const resp = await API.post('/auth/token', form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    console.log('Login resp status', resp.status)
    localStorage.setItem('token', resp.data.access_token)
    console.log('Stored token, length:', (resp.data.access_token||'').length)
    return resp.data
  }catch(err){
    console.error('Login error response:', err && err.response ? err.response.status : err, err.response && err.response.data)
    throw err
  }
}


export async function requestPasswordReset(email){
  return API.post('/auth/forgot-password', { email })
}


export async function verifyResetCode(email, code){
  return API.post('/auth/verify-reset-code', { email, code })
}


export async function resetPassword(reset_token, new_password){
  return API.post('/auth/reset-password', { reset_token, new_password })
}

export async function getPublicStats(){
  return API.get('/stats')
}

// External Listings
export async function createExternalListing(payload){
  return API.post('/external-listings', payload, authHeaders())
}

export async function listExternalListings(skip=0, limit=50, q){
  const qs = new URLSearchParams({ skip: String(skip), limit: String(limit) })
  if(q && String(q).trim()) qs.set('q', String(q).trim())
  return API.get(`/external-listings?${qs.toString()}`, authHeaders())
}

export async function getExternalListing(id){
  return API.get(`/external-listings/${id}`, authHeaders())
}

export async function addExternalInterest(id){
  return API.post(`/external-listings/${id}/interest`, {}, authHeaders())
}

export async function removeExternalInterest(id){
  return API.delete(`/external-listings/${id}/interest`, authHeaders())
}

// Phone (private)
export async function getMyPhone(){
  return API.get('/users/me/phone', authHeaders())
}

export async function setMyPhone(phone_number){
  return API.put('/users/me/phone', { phone_number }, authHeaders())
}

// Contact Requests
export async function createContactRequest(payload){
  return API.post('/contact-requests', payload, authHeaders())
}

export async function listIncomingContactRequests(){
  return API.get('/contact-requests/incoming', authHeaders())
}

export async function acceptContactRequest(id){
  return API.post(`/contact-requests/${id}/accept`, {}, authHeaders())
}

export async function declineContactRequest(id){
  return API.post(`/contact-requests/${id}/decline`, {}, authHeaders())
}

export async function getContactInfo(id){
  return API.get(`/contact-requests/${id}/contact`, authHeaders())
}

export function authHeaders(){
  const token = localStorage.getItem('token')
  return { headers: { Authorization: `Bearer ${token}` } }
}

export async function register(email, password){
  // accept optional full_name and phone via arguments object
  if (typeof password === 'object'){
    const { password: pw, full_name, phone, phone_number } = password
    return API.post('/auth/register', { email, password: pw, full_name, phone_number: phone_number || phone || null })
  }
  return API.post('/auth/register', { email, password })
}

export async function ownerApplications(){
  return API.get('/owner/applications', authHeaders())
}

export async function acceptApplication(id){
  return API.post(`/applications/${id}/accept`, {}, authHeaders())
}

export async function getNotifications(){
  return API.get('/notifications', authHeaders())
}

export async function markNotificationRead(id){
  return API.post(`/notifications/${id}/read`, {}, authHeaders())
}

export async function listApartments(){
  const resp = await API.get('/apartments')
  const data = resp.data
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.apartments)) return data.apartments
  console.error('Unexpected /apartments response shape', data)
  return []
}

export async function createApartment(data){
  return API.post('/apartments', data, authHeaders())
}

export async function applyApartment(id, message){
  return API.post(`/apartments/${id}/apply`, { message }, authHeaders())
}


export async function deleteApartment(id){
  return API.delete(`/apartments/${id}`, authHeaders())
}

export async function getApartmentApplied(id){
  return API.get(`/apartments/${id}/applied`, authHeaders())
}

export async function getApartmentsApplied(ids){
  return API.post('/apartments/applied', { ids }, authHeaders())
}

export async function getCurrentUser(){
  // Try a cache-bypassing request first (some CDNs/static hosts may return 304)
  try{
    const resp = await API.get('/users/me', { ...authHeaders(), headers: { ...(authHeaders().headers||{}), 'Cache-Control': 'no-cache', Pragma: 'no-cache' } })
    if (resp && resp.data) return resp.data
  }catch(e){
    console.warn('getCurrentUser no-cache attempt failed', e && e.response ? e.response.status : e)
  }
  // If no data, retry with a cache-busting query param using axios directly
  try{
    const baseUrl = API.defaults.baseURL || (await resolveBase())
    const url = new URL('/users/me', baseUrl).toString() + `?_=${Date.now()}`
    console.log('Fetching current user from', url)
    const r2 = await axios.get(url, authHeaders())
    if (r2 && r2.data) return r2.data
    console.warn('getCurrentUser returned empty data', r2)
    return null
  }catch(err){
    console.error('getCurrentUser final attempt failed', err && err.response ? err.response.status : err, err && err.response && err.response.data)
    throw err
  }
}

export async function updateProfile(data){
  return API.put('/users/me', data, authHeaders())
}

export async function changePassword(current_password, new_password){
  return API.post('/users/me/password', { current_password, new_password }, authHeaders())
}

export async function getAdminUsers(){
  return API.get('/admin/users', authHeaders())
}

export async function getAdminApartments(){
  return API.get('/admin/apartments', authHeaders())
}

export async function deleteAdminUser(id){
  return API.delete(`/admin/users/${id}`, authHeaders())
}

export async function deleteAdminApartment(id){
  return API.delete(`/admin/apartments/${id}`, authHeaders())
}

export async function getAdminApplications(){
  return API.get('/admin/applications', authHeaders())
}

export async function deleteAdminApplication(id){
  return API.delete(`/admin/applications/${id}`, authHeaders())
}

export async function adminCleanDB(){
  return API.post('/admin/clean', {}, authHeaders())
}

export async function adminSendEmail(payload){
  return API.post('/admin/email', payload, authHeaders())
}

export async function adminSendNotification(payload){
  return API.post('/admin/notifications', payload, authHeaders())
}

export async function getVapidPublicKey(){
  return API.get('/push/vapid-public-key')
}

export async function pushSubscribe(subscription){
  return API.post('/push/subscribe', subscription, authHeaders())
}

export async function pushUnsubscribe(endpoint){
  return API.post('/push/unsubscribe', { endpoint }, authHeaders())
}

// -----------------------------
// Community app
// -----------------------------

export async function communityListPosts(skip=0, limit=50, q){
  const qs = new URLSearchParams({ skip: String(skip), limit: String(limit) })
  if(q && String(q).trim()) qs.set('q', String(q).trim())
  return API.get(`/community/posts?${qs.toString()}`, authHeaders())
}

export async function communityCreatePost(payload){
  return API.post('/community/posts', payload, authHeaders())
}

export async function communityListComments(postId){
  return API.get(`/community/posts/${postId}/comments`, authHeaders())
}

export async function communityAddComment(postId, payload){
  return API.post(`/community/posts/${postId}/comments`, payload, authHeaders())
}

export async function communityListEvents(q){
  const s = (q || '').trim()
  const qs = s ? `?q=${encodeURIComponent(s)}` : ''
  return API.get(`/community/events${qs}`, authHeaders())
}

export async function communityCreateEvent(payload){
  return API.post('/community/events', payload, authHeaders())
}

export async function communityListUsers(){
  return API.get('/community/users', authHeaders())
}

export async function communityInbox(){
  return API.get('/community/messages/inbox', authHeaders())
}

export async function communitySent(){
  return API.get('/community/messages/sent', authHeaders())
}

export async function communitySendMessage(payload){
  return API.post('/community/messages', payload, authHeaders())
}

export async function communityMarkMessageRead(id){
  return API.post(`/community/messages/${id}/read`, {}, authHeaders())
}

export async function adminCommunityPosts(){
  return API.get('/admin/community/posts', authHeaders())
}

export async function adminPinCommunityPost(postId, is_pinned){
  return API.post(`/admin/community/posts/${postId}/pin`, { is_pinned }, authHeaders())
}

export async function adminDeleteCommunityPost(postId){
  return API.delete(`/admin/community/posts/${postId}`, authHeaders())
}

export async function adminCommunityEvents(status){
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  return API.get(`/admin/community/events${q}`, authHeaders())
}

export async function adminApproveCommunityEvent(eventId){
  return API.post(`/admin/community/events/${eventId}/approve`, {}, authHeaders())
}

export async function adminRejectCommunityEvent(eventId){
  return API.post(`/admin/community/events/${eventId}/reject`, {}, authHeaders())
}

// -----------------------------
// Resources app
// -----------------------------

export async function resourcesListItems(category, q){
  const qs = new URLSearchParams()
  if(category) qs.set('category', category)
  if(q && String(q).trim()) qs.set('q', String(q).trim())
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return API.get(`/resources/items${suffix}`, authHeaders())
}

export async function resourcesCreateItem(payload){
  return API.post('/resources/items', payload, authHeaders())
}

export async function resourcesSaveItem(id){
  return API.post(`/resources/items/${id}/save`, {}, authHeaders())
}

export async function resourcesUnsaveItem(id){
  return API.delete(`/resources/items/${id}/save`, authHeaders())
}

export async function resourcesSaved(){
  return API.get('/resources/saved', authHeaders())
}

export async function adminResourcesItems(status){
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  return API.get(`/admin/resources/items${q}`, authHeaders())
}

export async function adminApproveResource(id){
  return API.post(`/admin/resources/items/${id}/approve`, {}, authHeaders())
}

export async function adminRejectResource(id){
  return API.post(`/admin/resources/items/${id}/reject`, {}, authHeaders())
}

export async function adminDeleteResource(id){
  return API.delete(`/admin/resources/items/${id}`, authHeaders())
}

// -----------------------------
// Jobs app
// -----------------------------

export async function jobsList(q){
  const s = (q || '').trim()
  const qs = s ? `?q=${encodeURIComponent(s)}` : ''
  return API.get(`/jobs/listings${qs}`, authHeaders())
}

export async function jobsCreate(payload){
  return API.post('/jobs/listings', payload, authHeaders())
}

export async function jobsSave(id){
  return API.post(`/jobs/listings/${id}/save`, {}, authHeaders())
}

export async function jobsUnsave(id){
  return API.delete(`/jobs/listings/${id}/save`, authHeaders())
}

export async function jobsSaved(){
  return API.get('/jobs/saved', authHeaders())
}

export async function jobsApply(id, payload){
  return API.post(`/jobs/listings/${id}/apply`, payload || {}, authHeaders())
}

export async function jobsListApplications(id){
  return API.get(`/jobs/listings/${id}/applications`, authHeaders())
}

export async function jobsMyApplications(){
  return API.get('/jobs/my-applications', authHeaders())
}

export async function adminJobsListings(status){
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  return API.get(`/admin/jobs/listings${q}`, authHeaders())
}

export async function adminApproveJob(id){
  return API.post(`/admin/jobs/listings/${id}/approve`, {}, authHeaders())
}

export async function adminRejectJob(id){
  return API.post(`/admin/jobs/listings/${id}/reject`, {}, authHeaders())
}

export async function adminDeleteJob(id){
  return API.delete(`/admin/jobs/listings/${id}`, authHeaders())
}
