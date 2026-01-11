import axios from 'axios'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

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
  return API.post('/auth/register', { email, password })
}

export async function listApartments(){
  const resp = await API.get('/apartments')
  return resp.data
}

export async function createApartment(data){
  return API.post('/apartments', data, authHeaders())
}

export async function applyApartment(id, message){
  return API.post(`/apartments/${id}/apply`, { message }, authHeaders())
}
