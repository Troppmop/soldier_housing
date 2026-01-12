import axios from 'axios'

// Ensure VITE_API_URL is an absolute URL (includes protocol). Some deploys mistakenly
// set the env var without https:// which results in relative requests to the frontend
// host (e.g. /soldierhousing-backend-production.up.railway.app/...), causing 304s
// from the static server. Normalize here and log the resolved base URL to help
// debug deployed builds.
let base = import.meta.env.VITE_API_URL || 'http://localhost:8000'
if (base && !base.startsWith('http://') && !base.startsWith('https://')){
  base = 'https://' + base
}
console.log('API base URL:', base)

const API = axios.create({ baseURL: base })

export async function login(email, password){
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  try{
    const tokenUrl = new URL('/auth/token', base).toString()
    console.log('POST token to', tokenUrl)
    const resp = await axios.post(tokenUrl, form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    console.log('Login resp status', resp.status)
    localStorage.setItem('token', resp.data.access_token)
    console.log('Stored token, length:', (resp.data.access_token||'').length)
    return resp.data
  }catch(err){
    console.error('Login error response:', err && err.response ? err.response.status : err, err.response && err.response.data)
    throw err
  }
}

export function authHeaders(){
  const token = localStorage.getItem('token')
  return { headers: { Authorization: `Bearer ${token}` } }
}

export async function register(email, password){
  // accept optional full_name and phone via arguments object
  if (typeof password === 'object'){
    const { password: pw, full_name, phone } = password
    return API.post('/auth/register', { email, password: pw, full_name, phone })
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
    const url = new URL('/users/me', base).toString() + `?_=${Date.now()}`
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
