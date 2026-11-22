import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

// attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// expired / invalid token -> tell the app to log out
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const status = error.response?.status
    const isAuthCall = error.config?.url?.includes('/api/login') || error.config?.url?.includes('/api/account')
    if ((status === 401 || status === 403) && !isAuthCall && localStorage.getItem('token')) {
      window.dispatchEvent(new Event('auth:expired'))
    }
    return Promise.reject(error)
  },
)

export function errorText(err, fallback = 'Error') {
  const d = err?.response?.data?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg
  return fallback
}

export default api
