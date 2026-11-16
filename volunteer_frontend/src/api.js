import axios from 'axios'

// Change the address in .env (VITE_API_URL) if your backend runs somewhere else
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

export const errMsg = (e) => {
  const d = e?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x) => x.msg).join(', ')
  return e?.message || 'Something went wrong'
}

export const CATEGORIES = ['All', 'Environment', 'Social', 'Education', 'Animals', 'Health', 'Community']

export const fmtDate = (s) =>
  new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export const fmtTime = (s) =>
  new Date(s).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
