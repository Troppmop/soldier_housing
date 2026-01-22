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
