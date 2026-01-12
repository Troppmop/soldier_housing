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
  const resp = await API.post('/auth/token', form)
  localStorage.setItem('token', resp.data.access_token)
  return resp.data
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
  const resp = await API.get('/users/me', authHeaders())
  return resp.data
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
