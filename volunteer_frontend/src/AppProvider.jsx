import { useCallback, useEffect, useMemo, useState } from 'react'
import api from './api'
import dict, { LANGS, LOCALES } from './i18n'
import { AppContext } from './context'

const THEMES = ['green', 'pink', 'dark']

function initialTheme() {
  const saved = localStorage.getItem('theme')
  const theme = THEMES.includes(saved) ? saved : 'green'
  document.documentElement.dataset.theme = theme
  return theme
}

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  return raw.startsWith('/') ? raw : `/${raw}`
}

function readUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

export default function AppProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem('lang')
    return LANGS.includes(saved) ? saved : 'en'
  })
  const [theme, setTheme] = useState(initialTheme)
  const [user, setUser] = useState(readUser)
  const [path, setPath] = useState(parseHash)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const onHash = () => {
      setPath(parseHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((to) => {
    window.location.hash = to
  }, [])

  const showToast = useCallback((text, kind = 'ok') => {
    setToast({ text, kind, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const setLang = (l) => {
    setLangState(l)
    localStorage.setItem('lang', l)
  }
  useEffect(() => {
    document.documentElement.lang = lang === 'kz' ? 'kk' : lang
  }, [lang])

  const changeTheme = (nextTheme) => {
    localStorage.setItem('theme', nextTheme)
    document.documentElement.dataset.theme = nextTheme
    setTheme(nextTheme)
  }

  const login = (token, userData) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }
  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const updateUser = useCallback((updates) => {
    setUser((current) => {
      if (!current) return current
      const next = { ...current, ...updates }
      localStorage.setItem('user', JSON.stringify(next))
      return next
    })
  }, [])

  // Подтягивает свежую роль (super_organizer / organizer / pending) после F5
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return undefined
    let active = true
    api.get('/api/auth/me')
      .then(({ data }) => {
        if (!active) return
        localStorage.setItem('user', JSON.stringify(data))
        setUser(data)
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    const onExpired = () => {
      logout()
      showToast(dict[lang].session_expired, 'error')
      navigate('/auth')
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [lang, logout, navigate, showToast])

  const value = useMemo(() => {
    const t = (key, ...args) => {
      const v = dict[lang][key] ?? dict.en[key] ?? key
      return typeof v === 'function' ? v(...args) : v
    }
    const fmt = (iso, opts) => (iso ? new Date(iso).toLocaleString(LOCALES[lang], opts) : '')
    const fmtDate = (iso) =>
      fmt(iso, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
    const fmtTime = (iso) => fmt(iso, { hour: '2-digit', minute: '2-digit', hour12: false })
    return {
      lang, setLang, theme, changeTheme, t, fmtDate, fmtTime,
      user, login, logout, updateUser, path, navigate, toast, showToast, api,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, theme, user, path, toast, logout, navigate, showToast])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}